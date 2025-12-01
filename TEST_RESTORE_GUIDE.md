# Testing Google Drive Restore - Complete Guide

## ⚠️ Important: Where Restore Looks for Files

The **"Restore from Drive"** function searches for backup files in:
- **Location**: Your Google Drive account
- **Folder**: `SmartLog_Finance_Backup`
- **File Type**: `.zip` files

It does **NOT** look for files:
- ❌ On your local computer
- ❌ In the app's backend folder
- ❌ From uploaded URLs or links

## 🔍 Current Issue

You uploaded `backup_2025-11-28_16-25-00_IST.zip` to the chat, but the app can't see it because it's not in your **Google Drive**.

## ✅ How to Test Restore (3 Methods)

### **Method 1: Use the App (Easiest)**

1. **Login to the app** with username: `admin` / password: `admin123`

2. **Connect to Google Drive:**
   - Click on your profile picture (top right)
   - Click **"Backup to Drive"**
   - If not connected, it will open Google sign-in
   - Sign in with your Google account
   - Grant permissions

3. **Create a Backup:**
   - After connecting, click **"Backup to Drive"** again
   - Wait for "✅ Synced!" message
   - This creates a backup in your Google Drive

4. **Test Restore:**
   - Click **"Restore from Drive"**
   - Should successfully restore the backup
   - Page will reload with restored data

### **Method 2: Manual Upload to Google Drive**

1. **Go to Google Drive:**
   - Open https://drive.google.com
   - Sign in with the same Google account you'll use in the app

2. **Find/Create the Backup Folder:**
   - Look for folder: `SmartLog_Finance_Backup`
   - If it doesn't exist, create it

3. **Upload Your Backup File:**
   - Open the `SmartLog_Finance_Backup` folder
   - Click **"+ New"** → **"File upload"**
   - Select your `backup_2025-11-28_16-25-00_IST.zip` file
   - Wait for upload to complete

4. **Test in App:**
   - Go back to the app
   - Make sure you're logged in with the same Google account
   - Click profile → **"Restore from Drive"**
   - Should find and restore your uploaded backup

### **Method 3: Check What's in Google Drive (Debug)**

You can check what backups exist in your Google Drive:

```bash
# After logging into the app and connecting Google Drive, run:
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8001/api/auth/sync-status
```

This will show you:
- If you're connected to Google Drive
- List of backup files found
- Their names and creation dates

**To get your JWT token:**
1. Login to the app
2. Open browser DevTools (F12)
3. Go to Console tab
4. Type: `localStorage.getItem('token')`
5. Copy the token (without quotes)

## 🧪 Quick Test Script

Here's a complete test flow:

```bash
# 1. Login to get token
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

# 2. Check Google Drive sync status
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8001/api/auth/sync-status | jq

# 3. If connected, trigger manual sync (creates backup)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8001/api/auth/sync-drive | jq

# 4. Check status again to see new backup
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8001/api/auth/sync-status | jq

# 5. Test restore
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8001/api/auth/restore-drive | jq
```

## 📝 Expected Results

### ✅ Success
```json
{
  "success": true,
  "message": "Data restored from Google Drive successfully",
  "fileName": "backup_2025-11-28_16-25-00_IST.zip",
  "createdTime": "2025-11-28T10:55:00.000Z"
}
```

### ❌ No Backup Found
```json
{
  "success": false,
  "message": "No backup found"
}
```

This means:
- No files in `SmartLog_Finance_Backup` folder in Google Drive
- Or not connected to Google Drive
- Or wrong Google account

## 🎯 Recommended Test Flow

1. **Start Fresh**: Login to app with `admin/admin123`
2. **Connect Google**: Click "Backup to Drive" → Sign in with Google
3. **Create Backup**: Click "Backup to Drive" again → Wait for success
4. **Make Changes**: Add some test data in the app
5. **Test Restore**: Click "Restore from Drive" → Verify data reverts
6. **Check Drive**: Go to Google Drive → Verify only 1 backup file exists (no duplicates!)

## 🐛 Troubleshooting

**"No backup found"**
- Check if you're signed in with Google (profile should show "Google Account" badge)
- Go to Google Drive and verify `SmartLog_Finance_Backup` folder exists with .zip files
- Try clicking "Backup to Drive" first to create a backup

**"Google authentication required"**
- Click "Backup to Drive" to sign in with Google
- Make sure you grant all permissions (Drive access)

**"Restore failed"**
- Check backend logs: `tail -f /var/log/supervisor/backend.out.log`
- Verify Google Drive folder has valid .zip backup files

## 🔧 For Electron Desktop App

The same logic applies for the Electron desktop version:
- Backups are stored in the user's Google Drive (not locally)
- Same folder: `SmartLog_Finance_Backup`
- Same restore process: Downloads from Google Drive and extracts

The fix we implemented (30-minute skip window) works for both web and Electron versions.
