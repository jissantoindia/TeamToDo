import { Client, Users, Databases, ID, Query } from 'node-appwrite';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const DATABASE_ID = '698cec760003f1ff45a1';
const TEAM_MEMBERS_COLLECTION = 'team-members';

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function buildInviteEmail(teamName, memberName, roleName, inviteLink) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;padding:40px 20px;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    <tr>
                        <td style="background:linear-gradient(135deg,#4f46e5,#6366f1,#818cf8);padding:40px 40px 32px;text-align:center;">
                            <div style="width:64px;height:64px;border-radius:16px;display:inline-block;background:rgba(255,255,255,0.2);line-height:64px;margin-bottom:16px;">
                                <span style="font-size:32px;color:#ffffff;">✓</span>
                            </div>
                            <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0 0 8px;letter-spacing:-0.5px;">
                                Welcome to ${teamName}!
                            </h1>
                            <p style="color:rgba(255,255,255,0.85);font-size:16px;margin:0;">
                                You've been invited to join our team workspace
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:40px;">
                            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
                                Hi <strong style="color:#111827;">${memberName}</strong>,
                            </p>
                            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
                                Great news! You have been added to the <strong style="color:#4f46e5;">${teamName}</strong> team as a member. Your role has been set to <strong style="color:#4f46e5;">${roleName}</strong>.
                            </p>
                            <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f0ff;border-radius:12px;border:1px solid #e0e7ff;margin:0 0 32px;">
                                <tr>
                                    <td style="padding:24px;">
                                        <p style="color:#4338ca;font-size:14px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">
                                            Your Account Details
                                        </p>
                                        <table cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td style="color:#6b7280;font-size:14px;padding:4px 0;width:100px;">Team:</td>
                                                <td style="color:#111827;font-size:14px;font-weight:600;padding:4px 0;">${teamName}</td>
                                            </tr>
                                            <tr>
                                                <td style="color:#6b7280;font-size:14px;padding:4px 0;">Role:</td>
                                                <td style="color:#111827;font-size:14px;font-weight:600;padding:4px 0;">${roleName}</td>
                                            </tr>
                                            <tr>
                                                <td style="color:#6b7280;font-size:14px;padding:4px 0;">Platform:</td>
                                                <td style="color:#111827;font-size:14px;font-weight:600;padding:4px 0;">TeamToDo</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 32px;">
                                To get started, please click the button below to set up your password and activate your account:
                            </p>
                            <table cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <a href="${inviteLink}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:12px;box-shadow:0 4px 16px rgba(79,70,229,0.32);">
                                            Set Your Password →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:32px 0 0;text-align:center;">
                                If the button doesn't work, copy and paste this link into your browser:<br>
                                <a href="${inviteLink}" style="color:#4f46e5;word-break:break-all;">${inviteLink}</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#f9fafb;padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
                            <p style="color:#9ca3af;font-size:13px;margin:0 0 4px;">
                                This invitation was sent by <strong>${teamName}</strong> via TeamToDo
                            </p>
                            <p style="color:#d1d5db;font-size:12px;margin:0;">
                                &copy; ${new Date().getFullYear()} ${teamName}. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

async function sendEmail(env, to, subject, html) {
    const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: parseInt(env.SMTP_PORT),
        secure: parseInt(env.SMTP_PORT) === 465,
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
        },
    });
    await transporter.sendMail({
        from: `"${env.TEAM_NAME || 'EBSGL'}" <${env.SMTP_USER}>`,
        to,
        subject,
        html,
    });
}

export default async ({ req, res, log, error }) => {
    // Setup Appwrite client with function's built-in context
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const users = new Users(client);
    const databases = new Databases(client);

    const env = process.env;
    const teamName = env.TEAM_NAME || 'EBSGL';
    const appUrl = env.APP_URL || 'http://localhost:5173';

    let body;
    try {
        body = JSON.parse(req.body || '{}');
    } catch (e) {
        return res.json({ error: 'Invalid JSON body' }, 400);
    }

    const action = body.action;

    // ──────── ACTION: INVITE ────────
    if (action === 'invite') {
        const { name, email, roleId, roleName, employeeId, mobile, gender, hourlyRate } = body;
        if (!name || !email) {
            return res.json({ error: 'Name and email are required.' }, 400);
        }

        try {
            // 1. Create Appwrite user
            let userId;
            const tempPassword = crypto.randomBytes(16).toString('hex');
            try {
                const user = await users.create(ID.unique(), email, undefined, tempPassword, name);
                userId = user.$id;
                log('User created: ' + userId);
            } catch (e) {
                if (e.code === 409) {
                    // User exists, find them
                    const userList = await users.list([Query.equal('email', [email])]);
                    if (userList.users.length > 0) {
                        userId = userList.users[0].$id;
                        log('User already exists: ' + userId);
                    } else {
                        return res.json({ error: 'User exists but could not be found.' }, 400);
                    }
                } else {
                    error('User creation failed: ' + e.message);
                    return res.json({ error: 'Failed to create user: ' + e.message }, 500);
                }
            }

            // 2. Generate invite token
            const inviteToken = generateToken();

            // 3. Create team-members document
            const payload = { name, email, roleId: roleId || '', userId, inviteToken, inviteStatus: 'pending' };
            if (employeeId) payload.employeeId = employeeId;
            if (mobile) payload.mobile = mobile;
            if (gender) payload.gender = gender;
            if (hourlyRate) payload.hourlyRate = parseFloat(hourlyRate);

            const doc = await databases.createDocument(DATABASE_ID, TEAM_MEMBERS_COLLECTION, ID.unique(), payload);
            log('Team member document created: ' + doc.$id);

            // 4. Send invitation email
            const inviteLink = `${appUrl}/set-password?token=${inviteToken}&email=${encodeURIComponent(email)}`;
            await sendEmail(env, email, `🎉 Welcome to ${teamName} — You're Invited!`, buildInviteEmail(teamName, name, roleName || 'Team Member', inviteLink));
            log('Invitation email sent to: ' + email);

            return res.json({ success: true, message: `Invitation sent to ${email}`, memberId: doc.$id });
        } catch (e) {
            error('Invite error: ' + e.message);
            return res.json({ error: 'Server error: ' + e.message }, 500);
        }
    }

    // ──────── ACTION: RESEND ────────
    if (action === 'resend') {
        const { memberId, name, email, roleName } = body;
        if (!email || !memberId) {
            return res.json({ error: 'Member ID and email required.' }, 400);
        }

        try {
            const inviteToken = generateToken();
            await databases.updateDocument(DATABASE_ID, TEAM_MEMBERS_COLLECTION, memberId, { inviteToken, inviteStatus: 'pending' });

            const inviteLink = `${appUrl}/set-password?token=${inviteToken}&email=${encodeURIComponent(email)}`;
            await sendEmail(env, email, `🔑 ${teamName} — Set Your Password`, buildInviteEmail(teamName, name || 'Team Member', roleName || 'Team Member', inviteLink));
            log('Invitation resent to: ' + email);

            return res.json({ success: true, message: `Invitation resent to ${email}` });
        } catch (e) {
            error('Resend error: ' + e.message);
            return res.json({ error: 'Failed to resend: ' + e.message }, 500);
        }
    }

    // ──────── ACTION: SET-PASSWORD ────────
    if (action === 'set-password') {
        const { email, token, password } = body;
        if (!email || !token || !password) {
            return res.json({ error: 'Email, token, and password are required.' }, 400);
        }
        if (password.length < 8) {
            return res.json({ error: 'Password must be at least 8 characters.' }, 400);
        }

        try {
            // Find member by email
            const docs = await databases.listDocuments(DATABASE_ID, TEAM_MEMBERS_COLLECTION, [Query.equal('email', [email])]);
            if (docs.documents.length === 0) {
                return res.json({ error: 'No invitation found for this email.' }, 404);
            }

            const member = docs.documents[0];
            if (member.inviteToken !== token) {
                return res.json({ error: 'Invalid or expired invitation link.' }, 400);
            }

            // Find user
            const userList = await users.list([Query.equal('email', [email])]);
            if (userList.users.length === 0) {
                return res.json({ error: 'User account not found.' }, 404);
            }

            // Update password
            await users.updatePassword(userList.users[0].$id, password);

            // Mark as accepted
            await databases.updateDocument(DATABASE_ID, TEAM_MEMBERS_COLLECTION, member.$id, { inviteStatus: 'accepted' });
            log('Password set for: ' + email);

            return res.json({ success: true, message: 'Password set successfully! You can now log in.' });
        } catch (e) {
            error('Set password error: ' + e.message);
            return res.json({ error: 'Server error: ' + e.message }, 500);
        }
    }

    return res.json({ error: 'Unknown action. Use: invite, resend, or set-password' }, 400);
};
