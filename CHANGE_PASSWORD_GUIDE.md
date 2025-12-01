# 🔐 Super Admin Password Management Guide

## Overview
This guide explains how to manually change the admin username and password after the app has been installed as an EXE.

---

## 📋 Prerequisites
- Node.js installed (to run the hash generator)
- Text editor (Notepad, VS Code, etc.)
- Access to the app's data folder

---

## 🔧 Step 1: Generate Password Hash

### Run the Hash Generator Tool

1. Navigate to the `backend` folder in your terminal/command prompt:
   ```bash
   cd backend
   ```

2. Run the password hash generator:
   ```bash
   node generate_password_hash.js
   ```

3. Enter your desired password when prompted

4. **Copy the generated hash** - it will look something like:
   ```
   $2a$10$F9gtgE8woreC950Q2VZYVOCO8/PmCW904rGXcnNlsR/fIgtnUeNdy
   ```

---

## 📂 Step 2: Locate the users.json File

After the app is installed, find the `users.json` file at:

### Windows:
```
C:\Users\[YourUsername]\AppData\Roaming\finance-app-desktop\data\users.json
```

### Mac:
```
~/Library/Application Support/finance-app-desktop/data/users.json
```

### Linux:
```
~/.config/finance-app-desktop/data/users.json
```

### Tips to find the folder:
- **Windows:** Press `Win + R`, type `%APPDATA%`, then navigate to `finance-app-desktop\data\`
- **Mac:** In Finder, press `Cmd + Shift + G`, paste the path above
- **Linux:** Use file manager or terminal to navigate to the path

---

## ✏️ Step 3: Edit users.json

1. Open `users.json` in a text editor (Notepad, VS Code, etc.)

2. You'll see something like this:
   ```json
   [
     {
       "id": "1234567890",
       "username": "admin",
       "password": "$2a$10$F9gtgE8woreC950Q2VZYVOCO8/PmCW904rGXcnNlsR/fIgtnUeNdy",
       "name": "Admin User",
       "email": "admin@example.com",
       "role": "Super Admin",
       "createdAt": "2025-01-15T10:00:00.000Z",
       "updatedAt": "2025-01-15T10:00:00.000Z"
     }
   ]
   ```

3. **Update the following fields:**
   - `username`: Change to your desired username
   - `password`: Paste the hash you generated in Step 1
   - `name`: (Optional) Change the display name
   - `email`: (Optional) Change the email

4. **Example after changes:**
   ```json
   [
     {
       "id": "1234567890",
       "username": "superadmin",
       "password": "$2a$10$NEW_HASH_YOU_GENERATED_GOES_HERE",
       "name": "Super Administrator",
       "email": "superadmin@company.com",
       "role": "Super Admin",
       "createdAt": "2025-01-15T10:00:00.000Z",
       "updatedAt": "2025-01-15T10:00:00.000Z"
     }
   ]
   ```

5. **Save the file**

---

## 🔄 Step 4: Restart the Application

1. Close the Finance App completely
2. Restart it
3. Login with your new username and password

✅ **Done!**

---

## 🛡️ Security Notes

- **Never share the password hash** - it can be reverse-engineered with enough effort
- **Keep the hash generator tool secure** - don't distribute it to end users
- **Backup users.json** before making changes
- Consider implementing a "Change Password" feature in the app UI for easier management in the future

---

## ⚠️ Troubleshooting

### "Invalid credentials" after changing password
- Verify you copied the **entire hash** (including `$2a$10$...`)
- Check for extra spaces or line breaks in the JSON file
- Ensure the JSON file is valid (use a JSON validator online)
- Make sure you saved the file after editing

### Can't find the data folder
- The app must be launched at least once to create the data folder
- Check if the app name in the path matches your app name
- Look in alternative locations if you changed the app name during build

### App won't start after editing
- Restore the backup of `users.json`
- Validate your JSON syntax at https://jsonlint.com/
- Check the console logs (View → Toggle Developer Tools in the app)

---

## 📞 Support

For additional help or to implement the in-app password change feature, contact your development team.

---

**Last Updated:** January 2025
