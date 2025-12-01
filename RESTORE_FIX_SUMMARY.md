# Google Drive Restore - Duplicate Files Fix

## Problem
When restoring data from Google Drive using the profile dropdown, the application was creating duplicate backup files instead of using the existing backup file.

## Root Cause
The issue was caused by the **auto-sync service** triggering immediately after a restore operation:

1. User clicks "Restore from Drive"
2. Application downloads and restores the latest backup successfully
3. Page reloads to show restored data
4. Auto-sync service (running every 15 minutes) detects the "new" data
5. Auto-sync immediately creates a NEW backup to Google Drive
6. Result: Duplicate backup files in Google Drive

## Solution Implemented

### 1. **Restore Timestamp Tracking** (`googleDriveService.js`)
- When a restore completes, we now mark the user's `lastRestoreTime` in `users.json`
- This timestamp is used to prevent auto-sync from triggering too soon after restore

```javascript
// Mark this user's restore timestamp to prevent immediate auto-sync
const updatedUsers = usersData.map(u => {
  if (u.id === userId) {
    return {
      ...u,
      lastRestoreTime: new Date().toISOString()
    };
  }
  return u;
});
```

### 2. **Auto-Sync Skip Logic** (`autoSyncService.js`)
- Auto-sync now checks if a user restored within the last **30 minutes**
- If yes, it skips that user's sync to avoid creating duplicates

```javascript
// Skip sync if user recently restored (within 30 minutes)
if (user.lastRestoreTime) {
  const restoreTime = new Date(user.lastRestoreTime);
  const now = new Date();
  const minutesSinceRestore = (now - restoreTime) / (1000 * 60);
  
  if (minutesSinceRestore < 30) {
    console.log(`⏭️ Skipping sync for user - restored ${Math.round(minutesSinceRestore)} minutes ago`);
    return;
  }
}
```

### 3. **Manual Sync Warning** (`authController.js`)
- Manual sync (when user explicitly clicks "Backup to Drive") is still allowed
- But logs a warning if user syncs within 5 minutes of restore
- This gives users control while preventing accidental duplicates

## Benefits

✅ **No Duplicate Files**: Restore operations no longer trigger automatic backups
✅ **Works in Web & Electron**: Solution works for both web and desktop (Electron exe) environments
✅ **User Control**: Users can still manually sync if needed after restore
✅ **Smart Timing**: 30-minute window ensures data stability after restore
✅ **Backward Compatible**: Works with existing backup files and doesn't break current functionality

## Testing

To verify the fix:

1. Place a backup file in Google Drive (e.g., `backup_2025-11-28_16-25-00_IST.zip`)
2. Click profile dropdown → "Restore from Drive"
3. Wait for restore to complete and page reload
4. Check Google Drive folder - should NOT see a new duplicate backup created
5. After 30 minutes, auto-sync will resume normally

## Technical Details

**Files Modified:**
- `/app/backend/services/googleDriveService.js` - Added restore timestamp tracking
- `/app/backend/services/autoSyncService.js` - Added 30-minute skip logic
- `/app/backend/controllers/authController.js` - Added manual sync warning

**Time Windows:**
- Auto-sync skip: 30 minutes after restore
- Manual sync warning: 5 minutes after restore (still allowed)

This fix ensures that restore operations work cleanly without creating unwanted duplicate files in Google Drive, while maintaining all existing functionality for both web and Electron desktop applications.
