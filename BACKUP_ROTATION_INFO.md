# Backup System - Time Stamped with 5-File Rotation

## ✅ Features Implemented

### 1. Time-Stamped Backup Files
**New Filename Format**: `backup_YYYY-MM-DD_HH-MM-SS.zip`

**Examples**:
- `backup_2025-11-28_14-30-45.zip`
- `backup_2025-11-28_18-22-10.zip`
- `backup_2025-11-29_09-15-33.zip`

**Benefits**:
- Multiple backups per day possible
- Easy to identify exact backup time
- No overwriting of same-day backups

### 2. Automatic 5-File Rotation
**How It Works**:
1. Every time a new backup is created
2. System counts total backup files in Google Drive
3. If count > 5, deletes oldest backups
4. Keeps only the 5 most recent backups

**Example Rotation**:
```
Before new backup (5 files):
1. backup_2025-11-28_09-00-00.zip (oldest)
2. backup_2025-11-28_12-00-00.zip
3. backup_2025-11-28_15-00-00.zip
4. backup_2025-11-28_18-00-00.zip
5. backup_2025-11-29_09-00-00.zip (newest)

After new backup created:
1. backup_2025-11-28_12-00-00.zip ← File #1 deleted
2. backup_2025-11-28_15-00-00.zip
3. backup_2025-11-28_18-00-00.zip
4. backup_2025-11-29_09-00-00.zip
5. backup_2025-11-29_12-30-45.zip ← New backup added
```

## Technical Implementation

### Location in Code
File: `/app/backend/services/googleDriveService.js`
Function: `syncToGoogleDrive()`

### Key Logic
```javascript
// Create filename with date and time
const now = new Date();
const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
const timeStr = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS
const backupFileName = `backup_${dateStr}_${timeStr}.zip`;

// Rotation logic
const allBackups = await drive.files.list({
  q: `'${folderId}' in parents and trashed=false and mimeType='application/zip'`,
  orderBy: 'createdTime desc', // Most recent first
  fields: 'files(id, name, createdTime)',
  spaces: 'drive'
});

// Keep first 5 (most recent), delete rest
if (backupFiles.length > 5) {
  const filesToDelete = backupFiles.slice(5);
  // Delete each old file
}
```

## Restore Behavior
- Always restores from the **most recent** backup
- No need to specify filename
- Automatic selection based on `createdTime desc` ordering

## Storage Optimization
- Maximum 5 files stored at any time
- Oldest files automatically cleaned up
- No manual intervention required
- Prevents unlimited storage growth

## Auto-Sync Service
- Runs every 5 minutes
- Automatically creates time-stamped backups
- Rotation happens automatically on each sync
- Works in background without user intervention

## Testing the System
```bash
# Check current backups
curl -X GET "https://your-app.com/api/auth/sync-status" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Manual sync (creates new backup)
curl -X POST "https://your-app.com/api/auth/sync-drive" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Restore from latest backup
curl -X POST "https://your-app.com/api/auth/restore-drive" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Important Notes
1. ✅ Time includes seconds for precise tracking
2. ✅ Time format uses hyphens (HH-MM-SS) to avoid filesystem issues
3. ✅ UTC time used for consistency across timezones
4. ✅ Rotation is safe - only deletes after successful upload
5. ✅ Failed uploads don't trigger rotation
6. ✅ Manual and auto-sync both follow same rotation rules

## Logs to Monitor
```bash
# Watch backend logs for sync activity
tail -f /var/log/supervisor/backend.out.log

# Look for these messages:
# ⬆️ Uploading backup to Google Drive: backup_YYYY-MM-DD_HH-MM-SS.zip
# 📊 Total backups found: X
# 🗑️ Deleting X old backup(s)...
# ✓ Deleted: backup_YYYY-MM-DD_HH-MM-SS.zip
# ✅ Sync completed successfully
```
