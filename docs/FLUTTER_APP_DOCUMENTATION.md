# TeamToDo — Flutter Mobile App Documentation

> **Complete technical specification for building the TeamToDo Flutter mobile application.**
> This app connects to the **same Appwrite backend** as the existing React web app.
> Date: February 12, 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Backend Configuration (Appwrite)](#2-backend-configuration-appwrite)
3. [Database Schema — All Collections](#3-database-schema--all-collections)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [App Modules — Detailed Specification](#5-app-modules--detailed-specification)
6. [TDo AI Chatbot — Gemini Integration](#6-tdo-ai-chatbot--gemini-integration)
7. [Push Notifications](#7-push-notifications)
8. [Holidays Module](#8-holidays-module)
9. [Notifications Section (In-App)](#9-notifications-section-in-app)
10. [Flutter Tech Stack & Dependencies](#10-flutter-tech-stack--dependencies)
11. [Project Structure](#11-project-structure)
12. [New Collections to Create](#12-new-collections-to-create)
13. [Web App Changes Required](#13-web-app-changes-required)

---

## 1. Project Overview

**TeamToDo** is a project management & team collaboration platform. The Flutter app provides:

### Employee Features
- **Login** — Email/password authentication via Appwrite
- **Dashboard** — Overview of pending tasks, quick stats
- **Tasks** — View tasks filtered by project & status (read-only review, status change)
- **Leaves** — View leave history, apply for new leave
- **Profile** — View/edit personal profile
- **Reports** — Personal leave, attendance (check-in/out details), task performance
- **TDo Chatbot** — AI assistant (same as web, Gemini-powered + voice)
- **Notifications** — Push + in-app notification center
- **Holidays** — View holiday calendar (paid & optional holidays)

### Director/Admin Features (additional)
- **Admin Reports Dashboard** — All team reports, graphs, pending items
- **Leave Approval** — Approve/reject leave requests
- **Task Management** — Assign tasks, mark as rework, change status
- **Send Notifications** — Broadcast general notifications to all users
- **Holiday Management** — Create/manage paid & optional holidays

---

## 2. Backend Configuration (Appwrite)

### Connection Details

```
APPWRITE_ENDPOINT    = https://fra.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID  = 698ce9a3002b537b3451
APPWRITE_DATABASE_ID = 698cec760003f1ff45a1
```

### API Keys

```
# Server-side API Key (for backend/cloud functions — NEVER embed in app)
APPWRITE_API_KEY = standard_4889130265aed84970cadfca95d0118ec22e4a1a0ce565e503188e26b29d4862a5a4d038300895dad13c011dfb49e3874d30c79bf332736a1c32624ace23f71fd7cb94db196bf82468ad09df9c76b39747f404604f4ebe1ad28baf2b3e0296fc292467519043e4f038ed4029c5ba2c19bbf620671e3821872f3b33f51a8c8a23

# Gemini API Key (for TDo chatbot + TTS)
GEMINI_API_KEY = AIzaSyB3X4-B_qq8nfwuUth9-a-cX-ISJwAikSI
```

### Flutter Appwrite Setup

```dart
import 'package:appwrite/appwrite.dart';

final client = Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('698ce9a3002b537b3451')
    .setSelfSigned(status: false);

final account = Account(client);
final databases = Databases(client);
final realtime = Realtime(client);

const String databaseId = '698cec760003f1ff45a1';
```

### Flutter pubspec.yaml — Required Appwrite SDK

```yaml
dependencies:
  appwrite: ^12.0.0  # Latest Appwrite Flutter SDK
```

---

## 3. Database Schema — All Collections

### 3.1 `projects` — Projects

| Attribute    | Type     | Size  | Required | Notes                              |
|-------------|----------|-------|----------|------------------------------------|
| name        | string   | 128   | ✅       | Project name                       |
| description | string   | 10000 | ❌       | Project description                |
| status      | string   | 20    | ✅       | `active`, `completed`, `on-hold`   |
| ownerId     | string   | 36    | ✅       | Appwrite User ID of project owner  |
| startDate   | datetime | —     | ❌       | ISO 8601 datetime                  |
| endDate     | datetime | —     | ❌       | ISO 8601 datetime                  |

### 3.2 `tasks` — Tasks

| Attribute      | Type     | Size  | Required | Notes                             |
|---------------|----------|-------|----------|-----------------------------------|
| title         | string   | 128   | ✅       | Task title                        |
| description   | string   | 10000 | ❌       | Task details                      |
| projectId     | string   | 36    | ❌       | FK → projects.$id                 |
| assigneeId    | string   | 36    | ❌       | Appwrite User ID of assignee      |
| status        | string   | 20    | ✅       | Status name (matches task-statuses)|
| priority      | string   | 10    | ✅       | `low`, `medium`, `high`, `urgent` |
| estimatedHours| double   | —     | ❌       | Decimal hours (e.g., 2.5 = 2h30m) |
| dueDate       | datetime | —     | ❌       | ISO 8601 datetime                 |

**Indexes:** `projectId` (key), `assigneeId` (key)

### 3.3 `time-entries` — Time Tracking

| Attribute | Type     | Size | Required | Notes                        |
|-----------|----------|------|----------|------------------------------|
| taskId    | string   | 36   | ✅       | FK → tasks.$id               |
| userId    | string   | 36   | ✅       | Appwrite User ID             |
| startTime | datetime | —    | ✅       | ISO 8601 datetime            |
| endTime   | datetime | —    | ❌       | null = still tracking        |
| duration  | double   | —    | ❌       | Duration in hours            |

### 3.4 `roles` — User Roles

| Attribute   | Type          | Size | Required | Notes                         |
|-------------|---------------|------|----------|-------------------------------|
| name        | string        | 50   | ✅       | Role name (e.g., "Director")  |
| permissions | string array  | 1000 | ❌       | Array of permission IDs       |

**Available Permission IDs:**
```
manage_projects   — Create/edit/delete projects
manage_tasks      — Create/edit/delete tasks
manage_team       — Add/edit/remove team members
manage_leaves     — Access leave management
approve_leaves    — Approve/reject leave requests
view_reports      — Access reports
manage_roles      — Manage roles & settings
ai_task_creator   — Access AI task creator
```

### 3.5 `team-members` — Team Members

| Attribute | Type   | Size | Required | Notes                          |
|-----------|--------|------|----------|--------------------------------|
| name      | string | 128  | ✅       | Display name                   |
| email     | string | 128  | ✅       | Email (matches Appwrite user)  |
| roleId    | string | 36   | ✅       | FK → roles.$id                 |
| userId    | string | 36   | ❌       | Appwrite User ID (linked)      |

**Indexes:** `email` (key)

### 3.6 `leaves` — Leave Requests

| Attribute | Type     | Size  | Required | Notes                                    |
|-----------|----------|-------|----------|------------------------------------------|
| userId    | string   | 36    | ✅       | Appwrite User ID                         |
| userName  | string   | 128   | ✅       | Display name (denormalized)              |
| startDate | string   | 20    | ✅       | Date string `YYYY-MM-DD`                 |
| endDate   | string   | 20    | ✅       | Date string `YYYY-MM-DD`                 |
| type      | string   | 20    | ✅       | `casual`, `sick`, `earned`, `menstrual`  |
| reason    | string   | 500   | ✅       | Leave reason                             |
| status    | string   | 20    | ✅       | `pending`, `approved`, `rejected`        |

### 3.7 `attendance` — Attendance Records

| Attribute    | Type     | Size | Required | Notes                          |
|-------------|----------|------|----------|--------------------------------|
| userId      | string   | 36   | ✅       | Appwrite User ID               |
| date        | string   | 20   | ✅       | Date string `YYYY-MM-DD`       |
| checkInTime | datetime | —    | ✅       | ISO 8601 check-in timestamp    |
| checkOutTime| datetime | —    | ❌       | null = still checked in        |
| status      | string   | 20   | ❌       | `present`, `late`, `absent`    |

### 3.8 `task-statuses` — Custom Task Statuses

| Attribute | Type   | Size | Required | Notes                          |
|-----------|--------|------|----------|--------------------------------|
| name      | string | 50   | ✅       | Status name (e.g., "In Review")|
| color     | string | 10   | ❌       | Hex color code                 |
| order     | int    | —    | ❌       | Sort order                     |

### 3.9 `tech-stacks` — Technology Stacks

| Attribute   | Type   | Size | Required |
|-------------|--------|------|----------|
| name        | string | 100  | ✅       |
| description | string | 5000 | ❌       |

### 3.10 `customers` — Customers

| Attribute | Type   | Size | Required |
|-----------|--------|------|----------|
| name      | string | 128  | ✅       |
| email     | string | 128  | ❌       |
| phone     | string | 20   | ❌       |
| company   | string | 128  | ❌       |
| notes     | string | 5000 | ❌       |

---

## 4. Authentication & Authorization

### Login Flow

```
1. User enters email + password
2. Call: account.createEmailPasswordSession(email, password)
3. On success: account.get() → returns User object
4. Lookup team-members where userId == user.$id (or email == user.email)
5. If found: load the role via member.roleId → roles collection
6. Store permissions array from the role
7. If NO team-member found: treat as app owner → grant ALL permissions
```

### Permission Check Logic

```dart
bool hasPermission(String permissionId) {
  // If user has no team-member record, they are the app owner => full access
  if (teamMember == null) return true;
  return userPermissions.contains(permissionId);
}

bool isDirector() {
  if (teamMember == null) return true;
  return userPermissions.contains('approve_leaves') ||
         userPermissions.contains('manage_roles');
}
```

### Role Hierarchy (existing in system)

| Role       | Key Permissions                                            |
|------------|-----------------------------------------------------------|
| Director   | ALL permissions (manage_projects, approve_leaves, etc.)   |
| Manager    | manage_tasks, manage_leaves, approve_leaves, view_reports |
| Developer  | manage_tasks (own), manage_leaves                         |
| Employee   | Basic access (own tasks, apply leave, view attendance)    |

---

## 5. App Modules — Detailed Specification

### 5.1 Login Screen

- Email + password fields
- "Login" button → `account.createEmailPasswordSession()`
- Error handling (invalid credentials, network error)
- After login: navigate to Dashboard
- No signup from app (users are created via web admin panel)

### 5.2 Dashboard (Employee)

**Purpose:** Quick overview of the employee's workday

**UI Elements:**
- **Welcome Header** — "Good morning, {firstName}!" with date/time
- **Stats Cards Row:**
  - Total Tasks (assigned to user)
  - Pending Tasks (not completed)
  - Approved Leaves (this month)
  - Attendance Rate (this month)
- **Pending Tasks List** — Top 5 pending tasks with priority badges
- **Recent Activity** — Latest task status changes

**Data Queries:**
```
Tasks:    Query.equal('assigneeId', user.$id)
Leaves:   Query.equal('userId', user.$id)
Attendance: Query.equal('userId', user.$id), Query.equal('date', today)
```

### 5.3 Tasks Module

**Purpose:** Review assigned tasks, filter by project/status, update status

**Features:**
- **List View** — All tasks assigned to the logged-in user
- **Filter Bar:**
  - By Project (dropdown from projects collection)
  - By Status (dropdown from task-statuses collection)
  - By Priority (low/medium/high/urgent)
- **Task Card shows:** title, project name, priority badge, status chip, due date
- **Task Detail View:** full description, estimated hours, time entries
- **Status Change:** Dropdown to change task status (updates `tasks` collection)
- **For Directors:** Additional actions:
  - Assign task to a team member
  - Mark task as "rework" (change status back)
  - Change priority

**Queries:**
```
// Employee: own tasks
Query.equal('assigneeId', user.$id), Query.limit(100)

// Director: all tasks
Query.limit(200)

// Filter by project
Query.equal('projectId', selectedProjectId)

// Filter by status
Query.equal('status', selectedStatus)
```

### 5.4 Leaves Module

**Purpose:** View leave history, apply for new leave

**Features:**
- **My Leaves Tab:** Table/list of all user's leaves with status badges
  - Columns: Type, Dates, Reason, Status (pending/approved/rejected)
- **Apply Leave:** Button → Modal/form with:
  - Leave Type dropdown: `casual`, `sick`, `earned`, `menstrual` (if female)
  - Start Date picker
  - End Date picker
  - Reason text field
  - Submit → creates document in `leaves` collection with `status: 'pending'`
- **For Directors — Approval Tab:**
  - List of all `status == 'pending'` leaves
  - Each item shows: employee name, type, dates, reason
  - Approve / Reject buttons → updates `status` field

**Leave Application Payload:**
```json
{
  "userId": "user.$id",
  "userName": "user.name",
  "startDate": "2026-02-15",
  "endDate": "2026-02-17",
  "type": "casual",
  "reason": "Family function",
  "status": "pending"
}
```

### 5.5 Profile Module

**Purpose:** View and edit personal profile information

**Features:**
- Display: Name, Email, Role, Position
- Avatar (initials-based or photo)
- Team member details from `team-members` collection
- Edit capabilities: name (via Appwrite account.updateName)
- Password change: account.updatePassword
- Logout button

### 5.6 Reports Module (Employee)

**Purpose:** Personal performance dashboard

**Sections:**

**A. Leave Report:**
- Total leaves taken (by type)
- Leaves remaining (if you define quotas)
- Monthly breakdown chart

**B. Attendance Report:**
- Check-in / Check-out history (from `attendance` collection)
- Total hours worked per day/week/month
- Average check-in time, average working hours
- Late arrivals count

**C. Task Performance:**
- Total tasks completed
- Tasks by status (pie chart)
- Tasks by priority (bar chart)
- Average completion time
- On-time vs overdue tasks

**Data Sources:**
```
Attendance: Query.equal('userId', user.$id), Query.orderDesc('date'), Query.limit(100)
Tasks:      Query.equal('assigneeId', user.$id)
Leaves:     Query.equal('userId', user.$id)
TimeEntries: Query.equal('userId', user.$id)
```

### 5.7 Admin Reports Dashboard (Directors Only)

**Purpose:** Organization-wide analytics and management

**Visible only when:** `hasPermission('view_reports') || hasPermission('manage_roles')`

**Sections:**

**A. Team Overview:**
- Total employees, active projects, pending tasks
- Team attendance rate (today/this week/this month)
- Pending leave requests count

**B. Employee Performance Table:**
- Each employee: tasks completed, total hours, attendance rate
- Sortable columns

**C. Graphs & Charts:**
- Tasks by status (pie chart for all tasks)
- Tasks by project (bar chart)
- Team attendance trends (line chart — last 30 days)
- Leave trends by type (stacked bar chart)
- Workload distribution (tasks per team member)

**D. Pending Actions Panel:**
- Pending leave requests (with approve/reject)
- Overdue tasks list
- Unassigned tasks

**E. Quick Actions:**
- Approve/reject leaves directly
- Assign unassigned tasks
- Mark tasks as rework

---

## 6. TDo AI Chatbot — Gemini Integration

### Overview
The TDo chatbot is an AI assistant powered by Google Gemini. It can answer questions about tasks, leaves, attendance, and perform actions like creating leave requests.

### Gemini API Configuration

```
GEMINI_API_URL = https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
GEMINI_TTS_URL = https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent
GEMINI_API_KEY = AIzaSyB3X4-B_qq8nfwuUth9-a-cX-ISJwAikSI
```

### Chat Request Format

```json
POST {GEMINI_API_URL}?key={API_KEY}
{
  "systemInstruction": {
    "parts": [{ "text": "SYSTEM_PROMPT_WITH_USER_CONTEXT" }]
  },
  "contents": [
    { "role": "user", "parts": [{ "text": "user message" }] },
    { "role": "model", "parts": [{ "text": "assistant response" }] }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 2048
  }
}
```

### System Prompt Template

The system prompt includes live user context fetched from Appwrite:
- User name, email, role, permissions
- User's tasks (title, status, priority, project, due date)
- User's leaves (type, dates, status)
- Recent attendance records
- Available task statuses
- Team members list
- Today's date

### Action Blocks

The chatbot can perform actions by including JSON blocks in responses:

```
<<<ACTION:{"type":"create_leave","startDate":"2026-02-15","endDate":"2026-02-17","leaveType":"casual","reason":"Family function"}>>>
```

Parse the response for `<<<ACTION:...>>>` patterns and execute the corresponding Appwrite operations.

### Voice Features

**Voice Input:** Use Flutter `speech_to_text` package
**Voice Output (TTS):** Use Gemini TTS API

```json
POST {GEMINI_TTS_URL}?key={API_KEY}
{
  "contents": [{ "parts": [{ "text": "Text to speak" }] }],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "voiceConfig": {
        "prebuiltVoiceConfig": { "voiceName": "Orus" }
      }
    }
  }
}
```

Response returns base64-encoded audio in `candidates[0].content.parts[0].inlineData.data` with `mimeType` (usually `audio/L16;rate=24000`). Convert raw PCM to WAV and play with `audioplayers` package.

**Available Gemini Voices:** Orus, Puck, Charon, Kore, Fenrir, Zephyr

### Flutter Packages for Chatbot
```yaml
dependencies:
  speech_to_text: ^7.0.0    # Voice input
  audioplayers: ^6.0.0       # Audio playback
  http: ^1.0.0               # API calls
```

---

## 7. Push Notifications

### Architecture

Push notifications use **Firebase Cloud Messaging (FCM)** triggered by an **Appwrite Cloud Function** located at `functions/push-notifications/`.

```
Web/App Action → Appwrite DB Event → Cloud Function → FCM → Flutter App
```

### Cloud Function: `functions/push-notifications/`

The cloud function (`index.js`) handles 6 notification triggers:

| # | Trigger                    | Recipients          | Message Example                                    |
|---|----------------------------|---------------------|----------------------------------------------------|
| 1 | Leave request submitted    | Directors/Managers  | "John applied for casual leave (Feb 15-17)"        |
| 2 | Leave approved/rejected    | The applicant       | "Your casual leave has been approved ✅"            |
| 3 | Task assigned              | The assignee        | "New task: Build Login Screen (Priority: high)"     |
| 4 | Task marked as rework      | The assignee        | "Task 'Login Screen' has been marked for rework"    |
| 5 | General notification       | All or specific user| Custom title + message from admin panel              |
| 6 | Holiday created            | All users           | "Paid Holiday: Christmas Day on Dec 25"             |

### NEW Collection: `device-tokens`

**Create this collection in Appwrite to store FCM tokens from the Flutter app:**

| Attribute | Type   | Size | Required | Notes                          |
|-----------|--------|------|----------|--------------------------------|
| userId    | string | 36   | ✅       | Appwrite User ID               |
| token     | string | 500  | ✅       | FCM device token               |
| platform  | string | 20   | ✅       | `android` or `ios`             |

**Indexes:** `userId` (key)

### Firebase Setup

1. Create project at [Firebase Console](https://console.firebase.google.com)
2. Add **Android** app → download `google-services.json` → place in `android/app/`
3. Add **iOS** app → download `GoogleService-Info.plist` → place in `ios/Runner/`
4. Go to **Project Settings → Service Accounts → Generate New Private Key**
5. Save as `functions/push-notifications/serviceAccountKey.json`

### Cloud Function Environment Variables

```
APPWRITE_ENDPOINT       = https://fra.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID     = 698ce9a3002b537b3451
APPWRITE_API_KEY        = <server API key>
APPWRITE_DATABASE_ID    = 698cec760003f1ff45a1
FIREBASE_SERVICE_ACCOUNT = <JSON string or file path>
```

### Appwrite Event Triggers (set in Appwrite Console → Functions)

```
databases.698cec760003f1ff45a1.collections.leaves.documents.*.create
databases.698cec760003f1ff45a1.collections.leaves.documents.*.update
databases.698cec760003f1ff45a1.collections.tasks.documents.*.create
databases.698cec760003f1ff45a1.collections.tasks.documents.*.update
databases.698cec760003f1ff45a1.collections.notifications.documents.*.create
databases.698cec760003f1ff45a1.collections.holidays.documents.*.create
```

### Flutter Integration — Save Device Token

```dart
// lib/services/push_notification_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:appwrite/appwrite.dart';

class PushNotificationService {
  final Databases databases;
  final String databaseId;
  final String userId;

  PushNotificationService({required this.databases, required this.databaseId, required this.userId});

  Future<void> initialize() async {
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    final token = await messaging.getToken();
    if (token != null) await _saveToken(token);
    messaging.onTokenRefresh.listen(_saveToken);

    FirebaseMessaging.onMessage.listen(_handleForeground);
    FirebaseMessaging.onMessageOpenedApp.listen(_handleTap);
  }

  Future<void> _saveToken(String token) async {
    try {
      final existing = await databases.listDocuments(
        databaseId: databaseId, collectionId: 'device-tokens',
        queries: [Query.equal('userId', userId), Query.equal('token', token)],
      );
      if (existing.documents.isEmpty) {
        await databases.createDocument(
          databaseId: databaseId, collectionId: 'device-tokens', documentId: ID.unique(),
          data: {'userId': userId, 'token': token, 'platform': Platform.isAndroid ? 'android' : 'ios'},
        );
      }
    } catch (e) { print('Error saving FCM token: $e'); }
  }

  void _handleForeground(RemoteMessage msg) {
    // Show local notification using flutter_local_notifications
  }

  void _handleTap(RemoteMessage msg) {
    // Navigate based on msg.data['type']: 'leave_submitted' → Leaves, 'task_assigned' → Tasks
  }

  Future<void> removeToken() async {
    final token = await FirebaseMessaging.instance.getToken();
    if (token == null) return;
    final docs = await databases.listDocuments(
      databaseId: databaseId, collectionId: 'device-tokens',
      queries: [Query.equal('userId', userId), Query.equal('token', token)],
    );
    for (final doc in docs.documents) {
      await databases.deleteDocument(databaseId: databaseId, collectionId: 'device-tokens', documentId: doc.$id);
    }
  }
}
```

### Flutter main.dart Setup

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

@pragma('vm:entry-point')
Future<void> _bgHandler(RemoteMessage msg) async {
  await Firebase.initializeApp();
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_bgHandler);
  runApp(const MyApp());
}
```

### Android Notification Channel

```dart
const AndroidNotificationChannel channel = AndroidNotificationChannel(
  'teamtodo_notifications', 'TeamToDo Notifications',
  description: 'Notifications from TeamToDo', importance: Importance.high,
);
```

### HTTP API (Manual Trigger from Web App)

```javascript
// Call from React web app after an action
await fetch('CLOUD_FUNCTION_ENDPOINT', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'leave_status_changed',  // or 'task_assigned', 'notification_created', etc.
    payload: { $id: leaveId, userId, type: 'casual', startDate, endDate, status: 'approved' }
  })
});
```

### Example Flow: Leave Approval

```
1. Employee submits leave       → Appwrite creates doc in `leaves`
2. DB event fires               → Cloud function triggers `onLeaveSubmitted`
3. Function finds directors     → Looks up roles with 'approve_leaves' permission
4. Gets their FCM tokens        → From `device-tokens` collection
5. Sends FCM push              → "John applied for casual leave (Feb 15-17)"
6. Director approves            → Appwrite updates leave doc (status: approved)
7. DB event fires               → Cloud function triggers `onLeaveStatusChanged`
8. Gets applicant's FCM token   → Sends "Your casual leave has been approved ✅"
```

### Flutter Packages
```yaml
dependencies:
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
  flutter_local_notifications: ^18.0.0
```

---

## 8. Holidays Module

### NEW Collection: `holidays`

**Create this collection in Appwrite with ID: `holidays`**

| Attribute   | Type     | Size | Required | Notes                              |
|-------------|----------|------|----------|------------------------------------|
| name        | string   | 128  | ✅       | Holiday name (e.g., "Christmas")   |
| date        | string   | 20   | ✅       | Date string `YYYY-MM-DD`          |
| type        | string   | 20   | ✅       | `paid` or `optional`               |
| year        | integer  | —    | ✅       | Year (e.g., 2026)                  |
| description | string   | 500  | ❌       | Additional details                 |
| createdBy   | string   | 36   | ✅       | User ID who created it             |

**Indexes:** `year` (key), `date` (key)

### Logic

**Paid Holiday:**
- Automatically applied to all employees
- No attendance required
- Does not count as leave
- Appears in the attendance report as "Paid Holiday"

**Optional Holiday:**
- Employees can choose to take it
- If taken, deducted from their optional holiday quota
- If not taken, normal workday

### Admin Features (Web + App)
- Add holidays for the entire year (bulk or individual)
- Set type: Paid or Optional
- Edit/delete holidays
- View holiday calendar

### Employee Features (App)
- View yearly holiday calendar
- Paid holidays shown in green
- Optional holidays shown in orange
- Indicator on attendance if a day is a holiday

### Attendance Integration Logic
```
When loading attendance for a date:
1. Check if that date is in `holidays` collection
2. If type == 'paid': Mark as "Paid Holiday" (no check-in needed)
3. If type == 'optional': Show option to mark as holiday or workday
4. Holiday days should NOT count as absent in reports
```

---

## 9. Notifications Section (In-App)

### NEW Collection: `notifications`

**Create this collection in Appwrite with ID: `notifications`**

| Attribute   | Type     | Size | Required | Notes                              |
|-------------|----------|------|----------|------------------------------------|
| title       | string   | 200  | ✅       | Notification title                 |
| message     | string   | 2000 | ✅       | Notification body                  |
| type        | string   | 30   | ✅       | `leave`, `task`, `general`, `holiday` |
| targetUserId| string   | 36   | ❌       | Specific user (null = all users)   |
| createdBy   | string   | 36   | ✅       | Who sent it                        |
| isRead      | boolean  | —    | ❌       | Read status (per-user via separate collection or client-side) |

### Features

**Employee:**
- Bell icon with unread badge count
- List of notifications (newest first)
- Tap to mark as read
- Pull-to-refresh

**Admin (Web + App):**
- "Send Notification" button
- Form: Title + Message + Target (All / Specific user)
- Broadcasts push notification + creates `notifications` document

### Realtime Updates (Appwrite)
```dart
final subscription = realtime.subscribe([
  'databases.$databaseId.collections.notifications.documents'
]);

subscription.stream.listen((event) {
  // Check if notification is for this user or is general
  // Show local notification / update badge count
});
```

---

## 10. Flutter Tech Stack & Dependencies

```yaml
name: teamtodo_app
description: TeamToDo Mobile Application

dependencies:
  flutter:
    sdk: flutter

  # Appwrite
  appwrite: ^12.0.0

  # State Management
  provider: ^6.1.2
  # OR riverpod: ^2.5.0

  # Navigation
  go_router: ^14.0.0

  # UI
  flutter_svg: ^2.0.0
  cached_network_image: ^3.4.0
  shimmer: ^3.0.0

  # Charts (for Reports)
  fl_chart: ^0.69.0

  # Date/Time
  intl: ^0.19.0

  # AI Chatbot
  http: ^1.0.0
  speech_to_text: ^7.0.0
  audioplayers: ^6.0.0

  # Notifications
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
  flutter_local_notifications: ^18.0.0

  # Storage
  shared_preferences: ^2.3.0

  # Image
  image_picker: ^1.1.0
```

---

## 11. Project Structure

```
lib/
├── main.dart
├── config/
│   ├── appwrite_config.dart       # Appwrite client, constants
│   ├── gemini_config.dart         # Gemini API configuration
│   └── theme.dart                 # App theme, colors, typography
├── models/
│   ├── user_model.dart
│   ├── task_model.dart
│   ├── project_model.dart
│   ├── leave_model.dart
│   ├── attendance_model.dart
│   ├── role_model.dart
│   ├── team_member_model.dart
│   ├── holiday_model.dart
│   ├── notification_model.dart
│   └── time_entry_model.dart
├── services/
│   ├── auth_service.dart          # Login, logout, session management
│   ├── task_service.dart          # CRUD for tasks
│   ├── leave_service.dart         # CRUD for leaves
│   ├── attendance_service.dart    # Attendance records
│   ├── report_service.dart        # Report data aggregation
│   ├── holiday_service.dart       # Holiday CRUD
│   ├── notification_service.dart  # Notifications + push
│   ├── chatbot_service.dart       # Gemini API integration
│   └── tts_service.dart           # Gemini TTS
├── providers/
│   ├── auth_provider.dart
│   ├── task_provider.dart
│   ├── leave_provider.dart
│   └── notification_provider.dart
├── screens/
│   ├── login_screen.dart
│   ├── dashboard_screen.dart
│   ├── tasks/
│   │   ├── tasks_screen.dart
│   │   └── task_detail_screen.dart
│   ├── leaves/
│   │   ├── leaves_screen.dart
│   │   └── apply_leave_screen.dart
│   ├── profile_screen.dart
│   ├── reports/
│   │   ├── employee_report_screen.dart
│   │   └── admin_report_screen.dart
│   ├── chatbot_screen.dart
│   ├── notifications_screen.dart
│   └── holidays_screen.dart
└── widgets/
    ├── stat_card.dart
    ├── task_card.dart
    ├── leave_card.dart
    ├── chart_widgets.dart
    └── common/
        ├── loading_widget.dart
        └── error_widget.dart
```

---

## 12. New Collections to Create

### Run this setup to create new collections:

**Collection 1: `holidays`**
```
Attributes:
  - name: string(128), required
  - date: string(20), required
  - type: string(20), required        # 'paid' | 'optional'
  - year: integer, required
  - description: string(500), optional
  - createdBy: string(36), required
Indexes:
  - year (key)
  - date (key)
Permissions: read(any), write(any), update(any), delete(any)
```

**Collection 2: `notifications`**
```
Attributes:
  - title: string(200), required
  - message: string(2000), required
  - type: string(30), required         # 'leave' | 'task' | 'general' | 'holiday'
  - targetUserId: string(36), optional # null = broadcast to all
  - createdBy: string(36), required
Indexes:
  - targetUserId (key)
  - type (key)
Permissions: read(any), write(any), update(any), delete(any)
```

**Collection 3: `device-tokens`** _(Required for Push Notifications)_
```
Attributes:
  - userId:   string(36),  required    — Appwrite User ID
  - token:    string(500), required    — FCM device token
  - platform: string(20),  required    — 'android' or 'ios'
Indexes:
  - userId (key)
Permissions: read(any), write(any), update(any), delete(any)
```

### Update `appwrite.js` on the web (add to COLLECTIONS):
```javascript
HOLIDAYS: 'holidays',
NOTIFICATIONS: 'notifications',
DEVICE_TOKENS: 'device-tokens',
```

---

## 13. Web App Changes Required

### 13.1 Holiday Management Page (New)
- Add route `/holidays` in `App.jsx`
- Create `src/pages/Holidays.jsx`
- Admin can: add/edit/delete holidays
- All users see the holiday calendar
- Add `Holidays` to sidebar navigation (permission: `manage_roles` for admin, visible to all for viewing)

### 13.2 Notifications Section (New)
- Add route `/notifications` in `App.jsx`
- Create `src/pages/Notifications.jsx`
- Bell icon in Layout header with badge count
- Admin: form to send general notifications
- All users: list of notifications with read/unread status

### 13.3 Attendance Integration with Holidays
- In `Attendance.jsx`: check if today is a holiday before showing check-in
- In `Reports.jsx`: exclude paid holidays from absent days calculation
- Show holiday indicator in attendance history

### 13.4 Summary of New Permissions (optional)
```
manage_holidays   — Create/edit/delete holidays (add to Settings PERMISSIONS array)
send_notifications — Send general notifications
```

---

## Quick Reference — API Endpoints

| API | URL |
|-----|-----|
| Appwrite Endpoint | `https://fra.cloud.appwrite.io/v1` |
| Gemini Chat | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` |
| Gemini TTS | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent` |

| ID | Value |
|----|-------|
| Project ID | `698ce9a3002b537b3451` |
| Database ID | `698cec760003f1ff45a1` |
| Gemini Key | `AIzaSyB3X4-B_qq8nfwuUth9-a-cX-ISJwAikSI` |

---

**End of Documentation**
*This document contains everything needed to build the TeamToDo Flutter mobile application connecting to the existing Appwrite backend.*
