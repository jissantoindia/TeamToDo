# TeamToDo Push Notifications — Cloud Function

## Overview

This cloud function sends **push notifications** to the TeamToDo Flutter mobile app via **Firebase Cloud Messaging (FCM)**. It runs as an **Appwrite Cloud Function** or standalone Node.js server.

---

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Web App /   │────▶│  Appwrite Events │────▶│ Cloud       │
│  Flutter App │     │  or HTTP Trigger │     │ Function    │
└──────────────┘     └──────────────────┘     └──────┬──────┘
                                                      │
                                              ┌───────▼───────┐
                                              │ Firebase Cloud │
                                              │ Messaging (FCM)│
                                              └───────┬───────┘
                                                      │
                                              ┌───────▼───────┐
                                              │ Flutter App    │
                                              │ (Push Notif)   │
                                              └───────────────┘
```

---

## Notification Triggers

| # | Event                      | Who gets notified     | Message Example                                    |
|---|----------------------------|-----------------------|----------------------------------------------------|
| 1 | Leave request submitted    | Directors / Managers  | "John applied for casual leave (Feb 15-17)"        |
| 2 | Leave approved / rejected  | The applicant         | "Your casual leave has been approved"               |
| 3 | Task assigned              | The assignee          | "New task: Build Login Screen (Priority: high)"     |
| 4 | Task marked as rework      | The assignee          | "Task 'Login Screen' has been marked for rework"    |
| 5 | General notification       | All users or specific | Custom title + message from admin panel              |
| 6 | Holiday created            | All users             | "Paid Holiday: Christmas Day on Dec 25"             |

---

## Prerequisites

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. Add **Android** app:
   - Package name: `com.teamtodo.app` (match your Flutter app)
   - Download `google-services.json` → place in `android/app/`
4. Add **iOS** app:
   - Bundle ID: `com.teamtodo.app`
   - Download `GoogleService-Info.plist` → place in `ios/Runner/`
5. Go to **Project Settings → Service Accounts**
6. Click **"Generate New Private Key"**
7. Save the file as `serviceAccountKey.json` in this directory

### 2. New Appwrite Collection: `device-tokens`

Create this collection to store FCM tokens from the Flutter app:

```
Collection ID: device-tokens
Collection Name: Device Tokens

Attributes:
  - userId:   string(36),  required    — Appwrite User ID
  - token:    string(500), required    — FCM device token
  - platform: string(20),  required    — 'android' or 'ios'

Indexes:
  - userId (key)

Permissions: read(any), write(any), update(any), delete(any)
```

### 3. Environment Variables

| Variable                 | Description                              | Required |
|-------------------------|------------------------------------------|----------|
| APPWRITE_ENDPOINT       | `https://fra.cloud.appwrite.io/v1`       | ✅       |
| APPWRITE_PROJECT_ID     | `698ce9a3002b537b3451`                   | ✅       |
| APPWRITE_API_KEY        | Your Appwrite server API key             | ✅       |
| APPWRITE_DATABASE_ID    | `698cec760003f1ff45a1`                   | ✅       |
| FIREBASE_SERVICE_ACCOUNT| JSON string or path to service account   | ✅       |

---

## Deployment Options

### Option A: Appwrite Cloud Function

1. In Appwrite Console, go to **Functions → Create Function**
2. Set runtime: **Node.js 18+**
3. Upload this directory (or connect via Git)
4. Set environment variables (see table above)
5. Add event triggers:

```
Events to subscribe:
  databases.698cec760003f1ff45a1.collections.leaves.documents.*.create
  databases.698cec760003f1ff45a1.collections.leaves.documents.*.update
  databases.698cec760003f1ff45a1.collections.tasks.documents.*.create
  databases.698cec760003f1ff45a1.collections.tasks.documents.*.update
  databases.698cec760003f1ff45a1.collections.notifications.documents.*.create
  databases.698cec760003f1ff45a1.collections.holidays.documents.*.create
```

### Option B: Manual HTTP Trigger

Send a POST request to the function endpoint:

```bash
# Example: Send push for a leave request
curl -X POST https://your-function-url/push-notifications \
  -H "Content-Type: application/json" \
  -d '{
    "action": "leave_submitted",
    "payload": {
      "$id": "leave123",
      "userId": "user456",
      "userName": "John Doe",
      "type": "casual",
      "startDate": "2026-02-15",
      "endDate": "2026-02-17"
    }
  }'

# Example: Broadcast a notification
curl -X POST https://your-function-url/push-notifications \
  -H "Content-Type: application/json" \
  -d '{
    "action": "notification_created",
    "payload": {
      "$id": "notif123",
      "title": "Team Meeting",
      "message": "All-hands meeting at 3 PM tomorrow",
      "type": "general",
      "targetUserId": ""
    }
  }'
```

**Available Actions:**
| Action                  | Payload Fields Required                                    |
|------------------------|------------------------------------------------------------|
| `leave_submitted`      | `$id`, `userId`, `userName`, `type`, `startDate`, `endDate`|
| `leave_status_changed` | `$id`, `userId`, `type`, `startDate`, `endDate`, `status`  |
| `task_assigned`        | `$id`, `title`, `priority`, `assigneeId`                   |
| `task_rework`          | `$id`, `title`, `assigneeId`                               |
| `notification_created` | `$id`, `title`, `message`, `type`, `targetUserId`          |
| `holiday_created`      | `$id`, `name`, `date`, `type`, `description`               |

---

## Flutter App Integration

### 1. Add Dependencies

```yaml
# pubspec.yaml
dependencies:
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
  flutter_local_notifications: ^18.0.0
  appwrite: ^12.0.0
```

### 2. Initialize Firebase & Save Device Token

```dart
// lib/services/push_notification_service.dart

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:appwrite/appwrite.dart';

class PushNotificationService {
  final Databases databases;
  final String databaseId;
  final String userId;

  PushNotificationService({
    required this.databases,
    required this.databaseId,
    required this.userId,
  });

  /// Initialize FCM and save device token to Appwrite
  Future<void> initialize() async {
    final messaging = FirebaseMessaging.instance;

    // Request permission (iOS)
    await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Get FCM token
    final token = await messaging.getToken();
    if (token != null) {
      await _saveToken(token);
    }

    // Listen for token refresh
    messaging.onTokenRefresh.listen(_saveToken);

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle background/terminated messages
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageTap);
  }

  Future<void> _saveToken(String token) async {
    try {
      // Check if token already exists for this user
      final existing = await databases.listDocuments(
        databaseId: databaseId,
        collectionId: 'device-tokens',
        queries: [
          Query.equal('userId', userId),
          Query.equal('token', token),
        ],
      );

      if (existing.documents.isEmpty) {
        await databases.createDocument(
          databaseId: databaseId,
          collectionId: 'device-tokens',
          documentId: ID.unique(),
          data: {
            'userId': userId,
            'token': token,
            'platform': Platform.isAndroid ? 'android' : 'ios',
          },
        );
        print('✅ FCM token saved');
      }
    } catch (e) {
      print('⚠️ Error saving FCM token: $e');
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    print('📩 Foreground message: ${message.notification?.title}');
    // Show local notification using flutter_local_notifications
  }

  void _handleMessageTap(RemoteMessage message) {
    print('👆 Message tapped: ${message.data}');
    // Navigate to relevant screen based on message.data['type']
    // e.g., 'leave_submitted' → Navigate to Leaves screen
    //       'task_assigned'   → Navigate to Task detail screen
  }

  /// Remove token on logout
  Future<void> removeToken() async {
    final token = await FirebaseMessaging.instance.getToken();
    if (token == null) return;

    try {
      final existing = await databases.listDocuments(
        databaseId: databaseId,
        collectionId: 'device-tokens',
        queries: [
          Query.equal('userId', userId),
          Query.equal('token', token),
        ],
      );

      for (final doc in existing.documents) {
        await databases.deleteDocument(
          databaseId: databaseId,
          collectionId: 'device-tokens',
          documentId: doc.$id,
        );
      }
    } catch (e) {
      print('⚠️ Error removing FCM token: $e');
    }
  }
}
```

### 3. Initialize in main.dart

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('📩 Background message: ${message.notification?.title}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  runApp(const MyApp());
}
```

### 4. Android Configuration

Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="teamtodo_notifications" />
```

Create notification channel in Flutter:
```dart
const AndroidNotificationChannel channel = AndroidNotificationChannel(
  'teamtodo_notifications',
  'TeamToDo Notifications',
  description: 'Notifications from TeamToDo app',
  importance: Importance.high,
);
```

---

## How It Works (Flow)

### Example: Leave Approval Flow

```
1. Employee submits leave → Appwrite creates doc in `leaves` collection
2. Appwrite event triggers cloud function (collections.leaves.documents.*.create)
3. Cloud function:
   a. Reads the leave document
   b. Finds all directors (roles with 'approve_leaves' permission)
   c. Gets their FCM tokens from `device-tokens` collection
   d. Sends FCM push: "John applied for casual leave (Feb 15-17)"
4. Director sees push notification on their phone
5. Director approves → Appwrite updates leave doc (status: 'approved')
6. Appwrite event triggers cloud function (collections.leaves.documents.*.update)
7. Cloud function:
   a. Sees status changed to 'approved'
   b. Gets the applicant's FCM token
   c. Sends push: "Your casual leave has been approved ✅"
8. Employee sees approval notification
```

---

## Calling from Web App (Optional)

You can also trigger push notifications from the React web app by calling the cloud function endpoint when certain actions occur:

```javascript
// Example: After approving a leave
const triggerPush = async (action, payload) => {
    try {
        await fetch('YOUR_CLOUD_FUNCTION_ENDPOINT', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
        });
    } catch (err) {
        console.warn('Push notification trigger failed:', err);
    }
};

// Usage in Leaves.jsx after approval:
await handleStatusUpdate(leaveId, 'approved');
await triggerPush('leave_status_changed', {
    $id: leaveId, userId, type: 'casual',
    startDate: '2026-02-15', endDate: '2026-02-17',
    status: 'approved'
});
```

---

## Testing

### Health Check
```bash
curl https://your-function-url/push-notifications
# Response: { "ok": true, "service": "TeamToDo Push Notifications", ... }
```

### Test Push
```bash
curl -X POST https://your-function-url/push-notifications \
  -H "Content-Type: application/json" \
  -d '{
    "action": "notification_created",
    "payload": {
      "$id": "test1",
      "title": "Test Notification",
      "message": "Hello from TeamToDo!",
      "type": "general",
      "targetUserId": ""
    }
  }'
```
