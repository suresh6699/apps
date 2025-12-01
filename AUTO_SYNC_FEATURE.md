# Google Drive Auto-Sync Feature

## Overview
The Google Drive Auto-Sync feature automatically backs up your application data to Google Drive every 5 minutes for users who have connected their Google accounts.

## Key Features

### 1. Automatic Token Refresh
- **Problem Solved**: Google OAuth access tokens expire after ~1 hour
- **Solution**: The system automatically refreshes access tokens using refresh tokens before each sync
- **User Experience**: No manual re-authentication required (unless refresh token is invalid)

### 2. Background Sync Service
- **Frequency**: Every 5 minutes
- **First Run**: 1 minute after server start
- **Scope**: Syncs all users who have Google Drive connected

### 3. Intelligent Error Handling
- Detects token expiration and attempts refresh
- Logs detailed sync status for monitoring
- Gracefully handles failures without crashing
- Identifies users who need re-authentication

## Technical Implementation

### Components

#### 1. Auto-Sync Service (`/backend/services/autoSyncService.js`)
- Manages the 5-minute interval sync
- Handles token refresh for each user
- Provides detailed logging for debugging
- Updates user tokens in the database

#### 2. Google Auth Service (`/backend/services/googleAuthService.js`)
- Manages Google OAuth authentication
- Refreshes expired access tokens
- Provides OAuth2 clients with valid tokens

#### 3. Google Drive Service (`/backend/services/googleDriveService.js`)
- Creates backups of the data directory
- Uploads to Google Drive
- Manages backup folder structure
- Handles cleanup of temporary files

#### 4. Auth Controller (`/backend/controllers/authController.js`)
- Handles Google OAuth callback
- Stores and updates user tokens
- Provides manual sync endpoints
- Returns sync status

### API Endpoints

#### 1. Google OAuth Login
```
GET /api/auth/google
```
Initiates Google OAuth flow with Drive permissions

#### 2. Manual Sync
```
POST /api/auth/sync-drive
Authorization: Bearer <JWT_TOKEN>
```
Manually triggers a sync for the authenticated user

#### 3. Sync Status
```
GET /api/auth/sync-status
Authorization: Bearer <JWT_TOKEN>
```
Returns current sync status and list of backups

#### 4. Auto-Sync Status
```
GET /api/auth/auto-sync-status
Authorization: Bearer <JWT_TOKEN>
```
Returns auto-sync service status (running/stopped, interval, etc.)

## How Token Refresh Works

### Flow:
1. User authenticates with Google OAuth
2. System receives `accessToken` and `refreshToken`
3. Tokens are stored in `users.json`
4. Every 5 minutes, auto-sync runs:
   - Retrieves user's `refreshToken`
   - Calls Google OAuth to get new `accessToken`
   - Updates tokens in database
   - Uses new `accessToken` to upload backup
5. If refresh fails:
   - Logs error
   - Skips that user
   - Continues with other users
   - User can re-authenticate via frontend

### Token Lifecycle:
- **Access Token**: Expires after ~1 hour, refreshed automatically
- **Refresh Token**: Long-lived, used to get new access tokens
- **Re-authentication Required**: Only if refresh token becomes invalid

## Logs and Monitoring

### Auto-Sync Logs
The service provides detailed logs visible in backend logs:

```
📊 ===== Auto-Sync Starting =====
⏰ Time: [timestamp]
👥 Found X user(s) with Google Drive enabled

🔄 Syncing user: user@example.com
🔑 Refreshing access token for user: user@example.com
✅ Access token refreshed successfully
💾 Updated tokens saved for user: user@example.com
⬆️ Starting Google Drive upload for user: user@example.com
📦 Creating backup zip...
📁 Using folder ID: [folder_id]
🔍 Checking for existing backup...
⬆️ Uploading backup to Google Drive...
✅ Sync completed successfully: backup_2024-11-26.zip

📊 ===== Auto-Sync Complete =====
```

### Error Scenarios:

#### Token Refresh Failed
```
❌ Token refresh failed for user user@example.com: invalid_grant
⚠️ User user@example.com needs to re-authenticate with Google
```

#### Sync Failed
```
❌ Sync failed for user user@example.com: [error message]
🔒 Authentication error - re-authentication required
```

## Backup Structure

### Google Drive Folder
- **Folder Name**: `SmartLog_Finance_Backup`
- **Location**: Root of user's Google Drive
- **Backup Files**: `backup_YYYY-MM-DD.zip`
- **Strategy**: One backup per day (overwrites existing)

### Backup Contents
- All files from `/app/backend/data/` directory
- Includes: customers, transactions, collections, accounts, etc.
- Format: ZIP archive

## Testing the Feature

### 1. Connect Google Account
```bash
# Navigate to frontend
# Click on Google Sign-In
# Grant Drive permissions
```

### 2. Check Auto-Sync Status
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8001/api/auth/auto-sync-status
```

Response:
```json
{
  "running": true,
  "intervalMinutes": 5,
  "nextSyncIn": "Every 5 minutes"
}
```

### 3. Manual Sync
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8001/api/auth/sync-drive
```

### 4. Check Sync Status
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8001/api/auth/sync-status
```

Response:
```json
{
  "synced": true,
  "connected": true,
  "success": true,
  "backups": [
    {
      "id": "file_id",
      "name": "backup_2024-11-26.zip",
      "createdTime": "2024-11-26T10:30:00.000Z",
      "size": "1048576"
    }
  ],
  "autoSync": {
    "running": true,
    "intervalMinutes": 5,
    "nextSyncIn": "Every 5 minutes"
  }
}
```

### 5. Monitor Logs
```bash
# Watch auto-sync logs in real-time
tail -f /var/log/supervisor/backend.out.log | grep -E "Auto-Sync|Syncing user|token"
```

## Troubleshooting

### Issue: Sync not working
1. Check if user has Google account connected
2. Verify refresh token exists in users.json
3. Check backend logs for errors
4. Try manual sync to see specific error

### Issue: Token refresh failing
1. User needs to re-authenticate with Google
2. Sign out and sign in again via Google OAuth
3. Make sure to grant Drive permissions

### Issue: Auto-sync service not running
1. Check server logs on startup
2. Verify service started: `GET /api/auth/auto-sync-status`
3. Restart backend: `sudo supervisorctl restart backend`

### Issue: Backups not visible in Drive
1. Check Google Drive folder: `SmartLog_Finance_Backup`
2. Verify user granted Drive permissions
3. Check if backup succeeded in logs

## Configuration

### Change Sync Interval
Edit `/app/backend/services/autoSyncService.js`:
```javascript
this.SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
// Change to desired interval (in milliseconds)
```

### Change Backup Folder Name
Edit `/app/backend/services/googleDriveService.js`:
```javascript
this.FOLDER_NAME = 'SmartLog_Finance_Backup';
// Change to desired folder name
```

## Security Notes

- Refresh tokens are sensitive and stored in `users.json`
- Access tokens are automatically refreshed and updated
- Users can revoke access anytime from Google Account settings
- Tokens are encrypted in transit via HTTPS
- No passwords are stored for Google users

## Future Enhancements

1. **Restore Feature**: Add UI to restore from backups
2. **Backup History**: Keep multiple versions with cleanup policy
3. **Selective Sync**: Allow users to choose what to backup
4. **Sync Status Notifications**: Alert users on sync failures
5. **Manual Interval Control**: Let users set their own sync frequency
6. **Encryption**: Encrypt backup files before upload
7. **Multiple Cloud Providers**: Support Dropbox, OneDrive, etc.
