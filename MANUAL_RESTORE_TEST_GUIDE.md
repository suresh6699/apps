# Manual Restore Test Guide

## 📋 Overview

This guide explains how to test the restore functionality by manually uploading a backup file to Google Drive.

## 📦 Test Backup Files Available

Two backup files have been created for testing:

1. **`test_backup_manual_upload.zip`** - Simple name for easy identification
2. **`backup_2025-11-28_13-23-55_IST.zip`** - Proper format matching the app's auto-backup naming convention

Both files are located in `/app/` directory and contain identical data.

## 🔍 Backup Contents

The backup zip contains the complete data directory structure:

```
backup.zip
├── account_transactions/          (Account transaction records)
├── accounts/                      (Account information)
├── chat/                          (Customer chat messages)
├── chat_deleted/                  (Deleted chat messages)
├── customers/                     (Customer data organized by line ID)
│   ├── 1700000001/
│   │   ├── john_doe.json
│   │   └── mary_smith.json
│   ├── 1700000002/
│   │   └── raj_kumar.json
│   └── 1763812711881/
│       └── monda.json
├── days/                          (Daily summaries)
│   └── 1763812711881.json
├── deleted_customers/             (Soft-deleted customers)
├── lines.json                     (Financial lines data)
├── renewals/                      (Renewal records)
├── renewals_deleted/              (Deleted renewal records)
├── transactions/                  (Transaction data organized by line/customer)
│   └── 1763812711881/
│       └── monda/
│           └── 1763812871605_b6i79onn0.json
├── transactions_deleted/          (Deleted transactions)
└── users.json                     (User accounts and authentication)
```

**Total Files:** 24 files/folders  
**Total Size:** ~5 KB (5,055 bytes)

## 📤 How to Upload to Google Drive for Testing

### Method 1: Using Google Drive Web Interface

1. **Login to Google Drive**
   - Go to https://drive.google.com
   - Sign in with the same Google account used in the Finance Manager app

2. **Navigate to the Backup Folder**
   - Look for folder named: `SmartLog_Finance_Backup`
   - If it doesn't exist, create it (the app will also create it automatically)

3. **Upload the Backup File**
   - Click "New" → "File upload"
   - Select either:
     - `/app/test_backup_manual_upload.zip` OR
     - `/app/backup_2025-11-28_13-23-55_IST.zip`
   - Wait for upload to complete

4. **Verify Upload**
   - Check that the file appears in `SmartLog_Finance_Backup` folder
   - File should show as a `.zip` file

### Method 2: Using Google Drive Desktop App

1. Open Google Drive folder on your computer
2. Navigate to `SmartLog_Finance_Backup` folder
3. Copy the backup zip file into this folder
4. Wait for sync to complete

## 🔄 Testing the Restore Functionality

### Step 1: Prepare for Restore

1. **Login to Finance Manager App**
   - Use URL: https://782edf00-da80-41cf-9035-63c2d5a01d2c.preview.emergentagent.com
   - Login with credentials:
     - Username: `admin`
     - Password: `admin123`

2. **Connect Google Account** (if not already connected)
   - Click on profile icon/dropdown
   - Select "Sign in with Google"
   - Grant all required permissions (including Google Drive access)

### Step 2: Upload Backup to Google Drive

Follow the upload instructions from the previous section to place your test backup in the `SmartLog_Finance_Backup` folder.

### Step 3: Perform Restore

1. **Access Restore Function**
   - In the Finance Manager app, click on your profile dropdown
   - Look for "Restore from Google Drive" or sync options
   - Click "Restore" button

2. **Wait for Restore Process**
   - The app will:
     - Search for the latest backup in Google Drive
     - Download the zip file
     - Extract all data files
     - Replace current data (preserving user authentication)
     - Show success message

3. **Verify Restored Data**
   - Check Dashboard - should show lines:
     - "Office" line
     - "Home" line
   - Check Customers - should show:
     - John Doe, Mary Smith (Office line)
     - Raj Kumar (Home line)
     - Monda (another line)
   - Check Transactions - should show transaction for Monda

## 🧪 Expected Restore Behavior

### What Gets Restored
✅ All financial lines  
✅ All customers  
✅ All transactions  
✅ Account data  
✅ Daily summaries  
✅ Chat histories  
✅ Deleted items (soft deletes)

### What Gets Preserved
🔒 **User authentication** (users.json is merged, not replaced)  
🔒 **Google OAuth tokens** (preserved for continued sync)  
🔒 **User sessions** (current login remains active)

### Restore Process Details

1. **Backup Search:**
   - Looks in `SmartLog_Finance_Backup` folder first
   - Falls back to entire Google Drive if not found
   - Selects most recent `.zip` file with "backup" in name

2. **File Processing:**
   - Downloads backup to temp location
   - Extracts to temporary directory
   - Validates structure

3. **Data Replacement:**
   - Clears current data directory
   - Copies all restored files
   - Merges users.json (preserves auth)
   - Marks restore timestamp (prevents immediate auto-sync)

4. **Cleanup:**
   - Removes temporary files
   - Updates restore status
   - Returns success/failure message

## 🎯 Testing Scenarios

### Scenario 1: Basic Restore Test
1. Upload `test_backup_manual_upload.zip` to Google Drive
2. Click "Restore from Google Drive" in app
3. Verify all data appears correctly
4. ✅ **Expected:** Data loads successfully

### Scenario 2: Multiple Backups Test
1. Upload 2-3 different backup files with different names
2. Click "Restore"
3. ✅ **Expected:** Most recent backup (by creation date) is restored

### Scenario 3: Wrong Location Test
1. Upload backup to Google Drive root (not in SmartLog_Finance_Backup folder)
2. Click "Restore"
3. ✅ **Expected:** App still finds and restores the backup (fallback search)

### Scenario 4: No Backup Test
1. Delete all backups from Google Drive
2. Click "Restore"
3. ✅ **Expected:** Error message: "No backup found in Google Drive"

### Scenario 5: After-Restore Sync Test
1. Perform a restore
2. Wait 5-10 minutes
3. Make a data change (add customer)
4. Click "Sync to Google Drive"
5. ✅ **Expected:** New backup created with updated data

## 📊 Backup File Naming Convention

The app uses this format for auto-created backups:
```
backup_YYYY-MM-DD_HH-MM-SS_IST.zip
```

Example:
```
backup_2025-11-28_13-23-55_IST.zip
```

- Date/time is in **IST** (Indian Standard Time, UTC+5:30)
- Format ensures chronological sorting
- Most recent file is always selected for restore

## 🔧 Troubleshooting

### Issue: "No backup found"
**Solutions:**
- Verify file is uploaded to Google Drive
- Check filename contains "backup" and ends with ".zip"
- Ensure file is in `SmartLog_Finance_Backup` folder (or root)
- Check Google account is correctly linked

### Issue: "Google authentication expired"
**Solutions:**
- Sign out and sign in again with Google
- Re-grant Drive permissions
- Check Google tokens in user profile

### Issue: Restore appears to hang
**Solutions:**
- Check browser console for errors
- Verify internet connection
- Check backend logs: `tail -f /var/log/supervisor/backend.out.log`
- Large backups may take 1-2 minutes

### Issue: Data not restored correctly
**Solutions:**
- Verify zip file structure matches expected format
- Check backend logs for extraction errors
- Ensure all required folders exist in zip
- Try creating a new backup first, then restore it

## 📁 File Locations

- **Test Backups:** `/app/test_backup_manual_upload.zip` and `/app/backup_2025-11-28_13-23-55_IST.zip`
- **Live Data Directory:** `/app/backend/data/`
- **Temporary Restore Files:** `/app/backend/temp_restore_*.zip` (auto-deleted)
- **Backend Logs:** `/var/log/supervisor/backend.out.log`

## 🔐 Important Notes

1. **Users.json Preservation:**
   - The restore process preserves your current authentication
   - Your login session remains active after restore
   - Google OAuth tokens are maintained

2. **Auto-Sync Cooldown:**
   - After restore, auto-sync is paused for 30 minutes
   - This prevents immediately overwriting the restored data
   - Manual sync is still available if needed

3. **Backup Rotation:**
   - App keeps only 5 most recent backups
   - Older backups are automatically deleted
   - Manual backups don't count toward rotation

4. **Data Safety:**
   - Always test restore in a non-production environment first
   - Keep manual backup copies outside Google Drive
   - Verify data integrity after restore

## ✅ Success Indicators

After a successful restore, you should see:

- ✅ Success message in the app
- ✅ Dashboard shows restored financial lines
- ✅ Customers appear in customer list
- ✅ Transactions are visible
- ✅ Sync status shows "Connected to Google Drive"
- ✅ Backend logs show "✅ Restore completed successfully"

## 📞 Support

If you encounter issues during testing:

1. Check backend logs: `tail -f /var/log/supervisor/backend.out.log`
2. Check browser console for frontend errors (F12 → Console tab)
3. Verify file structure matches expected format
4. Ensure Google authentication is active

---

**Last Updated:** November 28, 2025  
**App Version:** 1.0.0  
**Backup Format Version:** 1.0
