/**
 * TeamToDo Push Notification Cloud Function
 * 
 * This function runs as an Appwrite Cloud Function (or standalone Node.js server).
 * It listens for events (or is triggered via HTTP) and sends push notifications
 * to the Flutter app via Firebase Cloud Messaging (FCM).
 * 
 * ─── TRIGGERS ───
 * 1. Leave Request Submitted    → Notifies directors/managers
 * 2. Leave Approved/Rejected    → Notifies the applicant
 * 3. Task Assigned              → Notifies the assignee
 * 4. Task Marked as Rework      → Notifies the assignee
 * 5. General Notification       → Broadcasts to all users (or specific user)
 * 6. Holiday Created            → Broadcasts to all users
 * 
 * ─── ENVIRONMENT VARIABLES ───
 * APPWRITE_ENDPOINT       - Appwrite API endpoint
 * APPWRITE_PROJECT_ID     - Appwrite project ID
 * APPWRITE_API_KEY        - Appwrite server-side API key
 * APPWRITE_DATABASE_ID    - Appwrite database ID
 * FIREBASE_SERVICE_ACCOUNT - Firebase service account JSON (stringified)
 *                            OR path to serviceAccountKey.json file
 * 
 * ─── SETUP INSTRUCTIONS ───
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Go to Project Settings → Service Accounts → Generate New Private Key
 * 3. Save the JSON file as `serviceAccountKey.json` in this directory
 *    OR set its contents as FIREBASE_SERVICE_ACCOUNT env variable
 * 4. In your Flutter app, integrate firebase_messaging and save device tokens
 *    to a new Appwrite collection called `device-tokens`
 * 5. Deploy this function to Appwrite Cloud Functions or run standalone
 */

import admin from 'firebase-admin';
import { Client, Databases, Query } from 'node-appwrite';
import { readFileSync, existsSync } from 'fs';

// ─── CONFIGURATION ───

const CONFIG = {
    APPWRITE_ENDPOINT: process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1',
    APPWRITE_PROJECT_ID: process.env.APPWRITE_PROJECT_ID || '698ce9a3002b537b3451',
    APPWRITE_API_KEY: process.env.APPWRITE_API_KEY || '',
    APPWRITE_DATABASE_ID: process.env.APPWRITE_DATABASE_ID || '698cec760003f1ff45a1',
};

const COLLECTIONS = {
    TEAM_MEMBERS: 'team-members',
    LEAVES: 'leaves',
    TASKS: 'tasks',
    NOTIFICATIONS: 'notifications',
    HOLIDAYS: 'holidays',
    DEVICE_TOKENS: 'device-tokens',   // NEW — stores FCM tokens per user
    ROLES: 'roles',
};

// ─── INITIALIZE FIREBASE ───

function initFirebase() {
    if (admin.apps.length > 0) return;

    let credential;

    // Option 1: Env variable with JSON string
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            credential = admin.credential.cert(serviceAccount);
        } catch {
            // Option 2: Env variable is a file path
            if (existsSync(process.env.FIREBASE_SERVICE_ACCOUNT)) {
                const raw = readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, 'utf8');
                credential = admin.credential.cert(JSON.parse(raw));
            }
        }
    }

    // Option 3: serviceAccountKey.json in the same directory
    if (!credential && existsSync('./serviceAccountKey.json')) {
        const raw = readFileSync('./serviceAccountKey.json', 'utf8');
        credential = admin.credential.cert(JSON.parse(raw));
    }

    if (!credential) {
        console.error('❌ Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT env or place serviceAccountKey.json');
        return false;
    }

    admin.initializeApp({ credential });
    console.log('✅ Firebase Admin initialized');
    return true;
}

// ─── INITIALIZE APPWRITE ───

function getAppwriteClient() {
    const client = new Client()
        .setEndpoint(CONFIG.APPWRITE_ENDPOINT)
        .setProject(CONFIG.APPWRITE_PROJECT_ID)
        .setKey(CONFIG.APPWRITE_API_KEY);
    return new Databases(client);
}

// ─── CORE: GET DEVICE TOKENS ───

/**
 * Fetch FCM device tokens for one or more user IDs.
 * Expects a `device-tokens` collection with: userId (string), token (string), platform (string)
 */
async function getDeviceTokens(databases, userIds) {
    const tokens = [];
    for (const userId of userIds) {
        try {
            const res = await databases.listDocuments(
                CONFIG.APPWRITE_DATABASE_ID,
                COLLECTIONS.DEVICE_TOKENS,
                [Query.equal('userId', userId), Query.limit(10)]
            );
            for (const doc of res.documents) {
                if (doc.token) tokens.push(doc.token);
            }
        } catch (err) {
            console.warn(`⚠️ Could not fetch tokens for user ${userId}:`, err.message);
        }
    }
    return tokens;
}

/**
 * Fetch FCM tokens for ALL registered users.
 */
async function getAllDeviceTokens(databases) {
    try {
        const res = await databases.listDocuments(
            CONFIG.APPWRITE_DATABASE_ID,
            COLLECTIONS.DEVICE_TOKENS,
            [Query.limit(500)]
        );
        return res.documents.map(d => d.token).filter(Boolean);
    } catch (err) {
        console.warn('⚠️ Could not fetch all device tokens:', err.message);
        return [];
    }
}

/**
 * Fetch user IDs of directors/managers (users with approve_leaves permission).
 */
async function getDirectorUserIds(databases) {
    try {
        // Step 1: Find roles with 'approve_leaves' permission
        const rolesRes = await databases.listDocuments(
            CONFIG.APPWRITE_DATABASE_ID,
            COLLECTIONS.ROLES,
            [Query.limit(50)]
        );
        const approverRoleIds = rolesRes.documents
            .filter(r => (r.permissions || []).includes('approve_leaves'))
            .map(r => r.$id);

        if (approverRoleIds.length === 0) return [];

        // Step 2: Find team members with those roles
        const userIds = [];
        for (const roleId of approverRoleIds) {
            const membersRes = await databases.listDocuments(
                CONFIG.APPWRITE_DATABASE_ID,
                COLLECTIONS.TEAM_MEMBERS,
                [Query.equal('roleId', roleId), Query.limit(50)]
            );
            for (const m of membersRes.documents) {
                if (m.userId) userIds.push(m.userId);
            }
        }
        return [...new Set(userIds)];
    } catch (err) {
        console.warn('⚠️ Could not fetch directors:', err.message);
        return [];
    }
}

// ─── CORE: SEND NOTIFICATION ───

/**
 * Send a push notification to specific FCM tokens.
 * @param {string[]} tokens - FCM device tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
async function sendPushNotification(tokens, title, body, data = {}) {
    if (!tokens || tokens.length === 0) {
        console.log('ℹ️ No device tokens to send to.');
        return { success: 0, failure: 0 };
    }

    const message = {
        notification: { title, body },
        data: {
            ...data,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        android: {
            priority: 'high',
            notification: {
                channelId: 'teamtodo_notifications',
                sound: 'default',
                icon: 'ic_notification',
            },
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1,
                },
            },
        },
    };

    let success = 0;
    let failure = 0;

    // Send to each token individually (handles stale tokens gracefully)
    for (const token of tokens) {
        try {
            await admin.messaging().send({ ...message, token });
            success++;
        } catch (err) {
            failure++;
            console.warn(`⚠️ Failed to send to token ${token.substring(0, 20)}...:`, err.message);
        }
    }

    console.log(`📤 Push sent: ${success} success, ${failure} failure`);
    return { success, failure };
}

// ─── NOTIFICATION HANDLERS ───

/**
 * Handle: Leave request submitted
 * Notifies all directors/managers.
 */
export async function onLeaveSubmitted(leaveDoc) {
    const databases = getAppwriteClient();
    const directorIds = await getDirectorUserIds(databases);
    const tokens = await getDeviceTokens(databases, directorIds);

    return sendPushNotification(
        tokens,
        '📅 New Leave Request',
        `${leaveDoc.userName} applied for ${leaveDoc.type} leave (${leaveDoc.startDate} to ${leaveDoc.endDate})`,
        { type: 'leave_submitted', leaveId: leaveDoc.$id }
    );
}

/**
 * Handle: Leave approved or rejected
 * Notifies the applicant.
 */
export async function onLeaveStatusChanged(leaveDoc) {
    const databases = getAppwriteClient();
    const tokens = await getDeviceTokens(databases, [leaveDoc.userId]);
    const emoji = leaveDoc.status === 'approved' ? '✅' : '❌';

    return sendPushNotification(
        tokens,
        `${emoji} Leave ${leaveDoc.status.charAt(0).toUpperCase() + leaveDoc.status.slice(1)}`,
        `Your ${leaveDoc.type} leave (${leaveDoc.startDate} to ${leaveDoc.endDate}) has been ${leaveDoc.status}.`,
        { type: 'leave_status', leaveId: leaveDoc.$id, status: leaveDoc.status }
    );
}

/**
 * Handle: Task assigned to a user
 * Notifies the assignee.
 */
export async function onTaskAssigned(taskDoc) {
    if (!taskDoc.assigneeId) return;
    const databases = getAppwriteClient();
    const tokens = await getDeviceTokens(databases, [taskDoc.assigneeId]);

    return sendPushNotification(
        tokens,
        '📋 New Task Assigned',
        `You have been assigned: "${taskDoc.title}" (Priority: ${taskDoc.priority})`,
        { type: 'task_assigned', taskId: taskDoc.$id }
    );
}

/**
 * Handle: Task marked as rework
 * Notifies the assignee.
 */
export async function onTaskRework(taskDoc) {
    if (!taskDoc.assigneeId) return;
    const databases = getAppwriteClient();
    const tokens = await getDeviceTokens(databases, [taskDoc.assigneeId]);

    return sendPushNotification(
        tokens,
        '🔄 Task Needs Rework',
        `Task "${taskDoc.title}" has been marked for rework. Please review.`,
        { type: 'task_rework', taskId: taskDoc.$id }
    );
}

/**
 * Handle: General notification sent from admin panel
 * Broadcasts to all users or a specific user.
 */
export async function onNotificationCreated(notifDoc) {
    const databases = getAppwriteClient();
    let tokens;

    if (notifDoc.targetUserId) {
        tokens = await getDeviceTokens(databases, [notifDoc.targetUserId]);
    } else {
        tokens = await getAllDeviceTokens(databases);
    }

    return sendPushNotification(
        tokens,
        notifDoc.title,
        notifDoc.message,
        { type: notifDoc.type, notificationId: notifDoc.$id }
    );
}

/**
 * Handle: Holiday created
 * Broadcasts to all users.
 */
export async function onHolidayCreated(holidayDoc) {
    const databases = getAppwriteClient();
    const tokens = await getAllDeviceTokens(databases);
    const typeLabel = holidayDoc.type === 'paid' ? 'Paid Holiday' : 'Optional Holiday';

    return sendPushNotification(
        tokens,
        `🎉 ${typeLabel}: ${holidayDoc.name}`,
        `${holidayDoc.name} on ${holidayDoc.date}. ${holidayDoc.description || ''}`.trim(),
        { type: 'holiday', holidayId: holidayDoc.$id }
    );
}

// ─── MAIN ENTRY POINT ───
// This function can be used as:
//   1. Appwrite Cloud Function (event-triggered)
//   2. Standalone HTTP server
//   3. Direct import in your backend

/**
 * Appwrite Cloud Function entry point.
 * Set up event triggers in Appwrite console:
 *   - databases.*.collections.leaves.documents.*.create     → onLeaveSubmitted
 *   - databases.*.collections.leaves.documents.*.update     → onLeaveStatusChanged
 *   - databases.*.collections.tasks.documents.*.create      → onTaskAssigned
 *   - databases.*.collections.tasks.documents.*.update      → onTaskRework (check status)
 *   - databases.*.collections.notifications.documents.*.create → onNotificationCreated
 *   - databases.*.collections.holidays.documents.*.create   → onHolidayCreated
 */
export default async function main({ req, res, log, error }) {
    if (!initFirebase()) {
        return res.json({ ok: false, error: 'Firebase not configured' }, 500);
    }

    // ─── HTTP Trigger (manual send) ───
    if (req.method === 'POST' && req.body) {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const { action, payload } = body;

            let result;
            switch (action) {
                case 'leave_submitted':
                    result = await onLeaveSubmitted(payload);
                    break;
                case 'leave_status_changed':
                    result = await onLeaveStatusChanged(payload);
                    break;
                case 'task_assigned':
                    result = await onTaskAssigned(payload);
                    break;
                case 'task_rework':
                    result = await onTaskRework(payload);
                    break;
                case 'notification_created':
                    result = await onNotificationCreated(payload);
                    break;
                case 'holiday_created':
                    result = await onHolidayCreated(payload);
                    break;
                default:
                    return res.json({ ok: false, error: `Unknown action: ${action}` }, 400);
            }

            log(`Action "${action}" completed: ${JSON.stringify(result)}`);
            return res.json({ ok: true, result });
        } catch (err) {
            error(`Error processing request: ${err.message}`);
            return res.json({ ok: false, error: err.message }, 500);
        }
    }

    // ─── Event Trigger (Appwrite database event) ───
    if (req.headers['x-appwrite-event']) {
        const event = req.headers['x-appwrite-event'];
        const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

        try {
            if (event.includes('collections.leaves.documents') && event.includes('.create')) {
                await onLeaveSubmitted(payload);
            } else if (event.includes('collections.leaves.documents') && event.includes('.update')) {
                if (payload.status === 'approved' || payload.status === 'rejected') {
                    await onLeaveStatusChanged(payload);
                }
            } else if (event.includes('collections.tasks.documents') && event.includes('.create')) {
                await onTaskAssigned(payload);
            } else if (event.includes('collections.tasks.documents') && event.includes('.update')) {
                // Check if status changed to a "rework" status
                await onTaskRework(payload);
            } else if (event.includes('collections.notifications.documents') && event.includes('.create')) {
                await onNotificationCreated(payload);
            } else if (event.includes('collections.holidays.documents') && event.includes('.create')) {
                await onHolidayCreated(payload);
            }

            log(`Event "${event}" processed`);
            return res.json({ ok: true });
        } catch (err) {
            error(`Error processing event: ${err.message}`);
            return res.json({ ok: false, error: err.message }, 500);
        }
    }

    // ─── Health Check ───
    return res.json({
        ok: true,
        service: 'TeamToDo Push Notifications',
        timestamp: new Date().toISOString(),
        triggers: [
            'leave_submitted', 'leave_status_changed',
            'task_assigned', 'task_rework',
            'notification_created', 'holiday_created'
        ]
    });
}
