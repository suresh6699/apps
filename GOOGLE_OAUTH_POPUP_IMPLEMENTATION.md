# Google OAuth Popup Implementation - Complete ✅

## Overview
This document describes the complete implementation of Google OAuth using popup windows instead of full-page redirects, providing a better user experience especially for the desktop Electron app.

## Architecture

### Flow Diagram
```
User Clicks "Continue with Google"
    ↓
Main Window opens Popup (600x700px)
    ↓
Popup loads Google OAuth page
    ↓
User authenticates with Google
    ↓
Google redirects to /api/auth/google/callback
    ↓
Backend creates JWT token & redirects to /#/callback?token=xxx&auth=google
    ↓
Popup window loads GoogleCallback component
    ↓
GoogleCallback detects it's in popup (checks window.opener)
    ↓
Sends postMessage with token to Main Window
    ↓
Main Window receives message & authenticates user
    ↓
Popup closes automatically
```

## Implementation Details

### 1. Frontend - Login Page (`/app/frontend/src/components/Login.jsx`)

#### Key Features:
- **Popup Function** (Lines 261-287): `openGooglePopup(url)`
  - Opens centered popup window (600x700px)
  - Handles popup blockers
  - Stores popup reference for cleanup
  
- **Message Listener** (Lines 89-161)
  - Listens for `GOOGLE_AUTH_SUCCESS` from popup
  - Validates origin for security
  - Handles token verification
  - Closes popup and authenticates user
  
- **Google Sign-In Button** (Lines 600-637)
  - Detects Electron environment
  - Opens popup for browser
  - Uses IPC for Electron
  - Shows loading state during authentication

#### Security Features:
- Origin validation on postMessage
- Popup blocker detection
- Automatic popup cleanup
- Timeout handling

### 2. Frontend - Profile Dropdown (`/app/frontend/src/components/ProfileDropdownWithSync.jsx`)

#### Sync & Restore Buttons:
Both buttons check if user has Google account connected:

- **Manual Sync** (Lines 18-53)
  - Opens popup if no googleId
  - Syncs data to Google Drive if authenticated
  
- **Restore** (Lines 55-92)
  - Opens popup if no googleId  
  - Restores data from Google Drive if authenticated

#### Popup Handler (Lines 100-160):
- Same popup logic as Login page
- Handles auth completion
- Reloads page to update user data

### 3. Frontend - Callback Handler (`/app/frontend/src/components/GoogleCallback.jsx`)

#### Critical Component:
This component handles the OAuth redirect and closes the popup loop.

**Logic:**
1. Extracts token from URL hash parameters
2. Detects if running in popup (`window.opener` exists)
3. If popup:
   - Sends `postMessage` with token to parent window
   - Closes after 1 second
4. If not popup (fallback):
   - Redirects to dashboard with token

**Security:**
- Uses `window.location.origin` for postMessage
- Validates token presence before sending

### 4. Electron - Main Process (`/app/electron/main.js`)

#### OAuth Window Handler (Lines 138-175):
- Creates modal OAuth window
- Intercepts callback redirects
- Extracts token from URL
- Sends to main window via IPC
- Closes OAuth window

#### IPC Handler (Lines 216-218):
```javascript
ipcMain.on('open-google-auth', (event, url) => {
  createOAuthWindow(url);
});
```

### 5. Electron - Preload Script (`/app/electron/preload.js`) ✅ ENHANCED

#### New Features Added:
```javascript
electron: {
  isElectron: true,
  
  // Open Google OAuth in Electron window
  openGoogleAuth: (url) => {
    ipcRenderer.send('open-google-auth', url);
  },
  
  // Listen for auth events
  onGoogleAuthSuccess: (callback) => {
    ipcRenderer.on('google-auth-success', (event, data) => callback(data));
  },
  onGoogleAuthError: (callback) => {
    ipcRenderer.on('google-auth-error', (event, data) => callback(data));
  }
}
```

**Security:**
- Context isolation enabled
- Limited IPC exposure
- Origin validation

### 6. Backend - Auth Routes (`/app/backend/routes/auth.js`)

#### Google OAuth Routes:
```javascript
// Initiate OAuth
GET /api/auth/google
  → Redirects to Google consent page

// Handle callback
GET /api/auth/google/callback  
  → Creates JWT token
  → Redirects to /#/callback?token=xxx&auth=google
```

### 7. Backend - Auth Controller (`/app/backend/controllers/authController.js`)

#### Google Callback Handler (Lines 136-191):
1. Receives Google profile from Passport
2. Finds or creates user in users.json
3. Stores Google tokens (access + refresh)
4. Generates JWT token
5. Redirects to frontend callback: `/#/callback?token=${token}&auth=google`

**Token Storage:**
- `googleAccessToken`: For API calls
- `googleRefreshToken`: For token renewal
- `googleId`: User identification

## User Experience

### Browser Flow:
1. Click "Continue with Google" → Popup opens
2. User authenticates in popup
3. Popup closes automatically
4. Main window shows dashboard

### Electron Flow:
1. Click "Continue with Google" → Native window opens
2. User authenticates
3. Window closes
4. Main app shows dashboard

### Sync/Restore Flow:
1. Click "Backup to Drive" without Google account
2. Popup opens for authentication
3. After auth, page reloads
4. Click "Backup to Drive" again → Syncs immediately

## Security Considerations

### ✅ Implemented:
- Origin validation on postMessage
- Context isolation in Electron
- JWT token validation
- HTTPS-only in production
- Session security
- CORS configuration

### 🔒 Best Practices:
- Tokens never logged
- Popup blocker handling
- Automatic cleanup
- Error handling
- Timeout protection

## Testing

### Manual Tests:
1. **Login Popup:**
   ```
   - Open app
   - Click "Continue with Google"
   - Verify popup opens (600x700)
   - Complete Google auth
   - Verify popup closes
   - Verify main window shows dashboard
   ```

2. **Sync Popup:**
   ```
   - Login as regular user (admin/admin123)
   - Click profile dropdown
   - Click "Backup to Drive"
   - Verify popup opens
   - Complete Google auth
   - Verify page reloads
   - Verify Google Account badge shows
   ```

3. **Restore Popup:**
   ```
   - Same as Sync test
   - Use "Restore from Drive" button
   ```

4. **Popup Blocker:**
   ```
   - Enable popup blocker
   - Try Google login
   - Verify error message shows
   - Disable blocker and retry
   ```

5. **Electron Desktop:**
   ```
   - Build electron app
   - Test same flows
   - Verify native window behavior
   ```

## Files Modified/Created

### ✅ Complete Implementation:
1. `/app/frontend/src/components/Login.jsx` - Popup logic added (Lines 261-287, 89-161, 600-637)
2. `/app/frontend/src/components/ProfileDropdownWithSync.jsx` - Popup for sync/restore (Lines 100-160)
3. `/app/frontend/src/components/GoogleCallback.jsx` - Callback handler ✅
4. `/app/electron/main.js` - OAuth window handler (Lines 138-218) ✅
5. `/app/electron/preload.js` - IPC bridge **✅ ENHANCED TODAY**
6. `/app/backend/controllers/authController.js` - Token generation (Lines 136-191) ✅
7. `/app/backend/routes/auth.js` - OAuth routes ✅

## Configuration

### Frontend Environment (`.env`):
```env
REACT_APP_API_URL=          # Empty for proxy
WDS_SOCKET_PORT=443
```

### Backend Environment (`.env`):
```env
PORT=8001
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback
FRONTEND_URL=https://your-domain.com
```

### Proxy Configuration (`frontend/package.json`):
```json
"proxy": "http://localhost:8001"
```

## Troubleshooting

### Issue: Popup blocked
**Solution:** User must allow popups. Error message is shown.

### Issue: Popup doesn't close
**Solution:** Check if `window.opener` exists. GoogleCallback component handles this.

### Issue: Token not received
**Solution:** Check browser console for postMessage errors. Verify origin matches.

### Issue: Electron IPC not working
**Solution:** Verify preload.js is loaded. Check `window.electron` exists.

### Issue: "Already authenticated" in popup
**Solution:** Clear cookies or use incognito for testing.

## Future Enhancements

### Possible Improvements:
1. Add "Close" button in popup header
2. Show progress indicator during auth
3. Handle token expiration gracefully
4. Add "Remember my choice" for Google account
5. Support multiple OAuth providers (GitHub, Microsoft)
6. Add session persistence across app restarts

## Status: ✅ COMPLETE

All components are implemented and working:
- ✅ Browser popup flow
- ✅ Electron native window flow  
- ✅ Sync/Restore popup flow
- ✅ Security measures
- ✅ Error handling
- ✅ Fallback behavior
- ✅ IPC communication **ENHANCED TODAY**

## Credits
Implementation completed with full popup support for Google OAuth across web and desktop platforms.
