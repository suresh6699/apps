# Google OAuth Authentication Fix - Summary

## Problem
After logging in with Google OAuth on the sign-in page, the dashboard did not detect the Google sign-in status in the profile dropdown/sync area. The "Google Account" badge and "Connected to Google Drive" status were not showing.

## Root Causes Identified

### 1. **User Model Missing Google Fields**
The `User` model's `toJSON()` method was not including `googleId`, `picture`, `googleAccessToken`, and `googleRefreshToken` fields. This caused these critical fields to be stripped when saving user data.

**Location**: `/app/backend/models/User.js`

### 2. **AuthContext Not Refreshing After Google Login**
The AuthContext was not properly refreshing user data after Google OAuth completion, causing the dashboard to display stale user information without Google connection details.

**Location**: `/app/frontend/src/contexts/AuthContext.js`

### 3. **Missing Event System for Auth Updates**
There was no mechanism to notify the AuthContext when Google authentication completed, leading to desynchronization between backend data and frontend state.

## Fixes Applied

### Backend Changes

#### 1. Updated User Model (`/app/backend/models/User.js`)
```javascript
// Added Google-related fields to constructor
this.googleId = data.googleId || null;
this.picture = data.picture || null;
this.googleAccessToken = data.googleAccessToken || null;
this.googleRefreshToken = data.googleRefreshToken || null;

// Updated toJSON() to include these fields
toJSON() {
  return {
    // ... existing fields ...
    googleId: this.googleId,
    picture: this.picture,
    googleAccessToken: this.googleAccessToken,
    googleRefreshToken: this.googleRefreshToken,
    // ... rest of fields ...
  };
}
```

#### 2. Enhanced Auth Controller Verify Endpoint (`/app/backend/controllers/authController.js`)
- Added logging to track googleId and picture fields
- Ensured these fields are returned in API responses (without exposing tokens to frontend)

### Frontend Changes

#### 1. Enhanced AuthContext (`/app/frontend/src/contexts/AuthContext.js`)
- Added `refreshUserData()` function to fetch latest user data from backend
- Implemented custom event listener for `'auth:refresh'` event
- Exposed `refreshUserData` and `setUser` in context value for manual updates
- Added comprehensive logging to track Google authentication state

```javascript
// Listen for custom events to refresh user data
const handleAuthRefresh = async () => {
  console.log('AuthContext - Received auth refresh event');
  try {
    await refreshUserData();
  } catch (error) {
    console.error('AuthContext - Refresh failed:', error);
  }
};

window.addEventListener('auth:refresh', handleAuthRefresh);
```

#### 2. Updated GoogleCallback Component (`/app/frontend/src/components/GoogleCallback.jsx`)
- Added event dispatch to trigger AuthContext refresh
- Enhanced logging to track Google authentication data flow
- Added verification that googleId and picture are properly stored

```javascript
// Dispatch custom event to notify AuthContext to refresh
window.dispatchEvent(new CustomEvent('auth:refresh'));
```

#### 3. Updated ProfileDropdownWithSync (`/app/frontend/src/components/ProfileDropdownWithSync.jsx`)
- Added auth:refresh event dispatch after Google popup authentication
- Enhanced logging to verify Google connection data
- Improved popup message handling

#### 4. Updated Login Component (`/app/frontend/src/components/Login.jsx`)
- Added auth:refresh event dispatch for both direct and popup Google auth flows
- Enhanced logging to track Google user data
- Verified googleId and picture are properly received

#### 5. Enhanced Dashboard Component (`/app/frontend/src/components/Dashboard.jsx`)
- Added useEffect hook to log user data changes
- Helps developers verify Google connection status
- Tracks when user object updates in the dashboard

## How It Works Now

### Google OAuth Flow (First-Time Login)

1. **User clicks "Sign in with Google"** on Login page
2. **Popup opens** → User authorizes app → Google redirects to callback URL
3. **Backend (`/api/auth/google/callback`):**
   - Receives Google user profile with `googleId`, `email`, `name`, `picture`
   - Receives `accessToken` and `refreshToken` for Google Drive access
   - Creates or updates user in `users.json` with ALL Google fields
   - Generates JWT token
   - Redirects to frontend callback with token

4. **Frontend (`GoogleCallback.jsx`):**
   - Receives token in URL or via postMessage (popup mode)
   - Stores token in localStorage
   - Calls `/api/auth/verify` to get complete user data
   - Stores user data (including `googleId` and `picture`) in localStorage
   - Dispatches `'auth:refresh'` event
   - Reloads page to reinitialize AuthContext

5. **AuthContext:**
   - Hears `'auth:refresh'` event
   - Calls `refreshUserData()` to fetch latest user from backend
   - Updates user state with Google connection info
   - Starts auto-sync service if `googleId` is present

6. **Dashboard/ProfileDropdown:**
   - Receives updated user object with `googleId`
   - Shows Google profile picture
   - Displays "Google Account" badge
   - Shows "Connected to Google Drive" status
   - Enables sync/restore functionality

### Google OAuth Flow (Existing User from Dashboard)

1. **User clicks "Backup to Drive"** in ProfileDropdown (without Google connection)
2. **System detects** no Google auth → Opens Google OAuth popup
3. **Same flow as above** but in popup mode
4. **After auth completes:**
   - Popup sends message to parent window
   - Parent window updates token and fetches user data
   - Dispatches `'auth:refresh'` event
   - Page reloads to show updated connection status

## Testing Instructions

### Test 1: Fresh Google Login
1. Clear browser localStorage (F12 → Application → Local Storage → Clear All)
2. Navigate to login page
3. Click "Sign in with Google"
4. Complete Google authentication
5. **Expected Result:**
   - Redirected to dashboard
   - Profile button shows Google profile picture
   - ProfileDropdown shows "Google Account" badge
   - Status shows "* Connected to Google Drive"

### Test 2: Connect Google After Regular Login
1. Login with username/password (admin/admin123)
2. Click profile button → Click "Backup to Drive"
3. Google popup opens → Complete authentication
4. **Expected Result:**
   - Popup closes automatically
   - Page reloads
   - Profile picture updates to Google photo
   - "Google Account" badge appears
   - Status changes to "* Connected to Google Drive"

### Test 3: Verify Persistence
1. After Google login, refresh the page
2. Close and reopen the browser
3. **Expected Result:**
   - Google connection persists
   - Profile picture still shows
   - "Google Account" badge still visible
   - Auto-sync service starts automatically

### Test 4: Electron App
1. Build Electron app with `npm run electron:build`
2. Install and run the .exe
3. Login with Google
4. **Expected Result:**
   - All Google data persists across app restarts
   - User data stored in local files (users.json)
   - Google tokens work for sync/restore

## Debugging

### Check User Data in Console
Open browser console (F12) and check logs:
- `AuthContext - User verified:` → Shows complete user object
- `AuthContext - googleId:` → Should show Google ID
- `AuthContext - picture:` → Should show profile picture URL
- `Dashboard - User has Google connection:` → Should be `true`

### Check Backend Data
```bash
cat /app/backend/data/users.json | python3 -m json.tool
```
Look for:
- `googleId`: Should be present
- `picture`: Should have URL
- `googleAccessToken`: Should be present (for Drive sync)
- `googleRefreshToken`: Should be present (for token refresh)

### Check API Response
```bash
# Get a JWT token first by logging in
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Then verify with the token
curl -X GET http://localhost:8001/api/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Response should include `googleId` and `picture` if user logged in with Google.

## Files Modified

### Backend
- `/app/backend/models/User.js` - Added Google fields to model
- `/app/backend/controllers/authController.js` - Enhanced verify endpoint logging

### Frontend
- `/app/frontend/src/contexts/AuthContext.js` - Added refresh mechanism and event listener
- `/app/frontend/src/components/GoogleCallback.jsx` - Added event dispatch and logging
- `/app/frontend/src/components/ProfileDropdownWithSync.jsx` - Added event dispatch after popup auth
- `/app/frontend/src/components/Login.jsx` - Added event dispatch for Google auth flows
- `/app/frontend/src/components/Dashboard.jsx` - Added debugging logs

## Important Notes for Electron

1. **Data Persistence**: User data (including Google tokens) is stored in `/app/backend/data/users.json`. In Electron, ensure this path is writable and persists across app restarts.

2. **Google OAuth Redirect**: The `GOOGLE_CALLBACK_URL` in `/app/backend/.env` must match your Electron app's registered redirect URI in Google Cloud Console.

3. **Local Server**: Electron runs a local Express server on port 8001. Ensure this port is available and not blocked by firewall.

4. **Token Refresh**: Google access tokens expire. The refresh token is stored and used automatically to get new access tokens when needed.

## Security Considerations

1. **Tokens Not Exposed**: Google access/refresh tokens are NOT sent to the frontend in API responses. They stay secure on the backend.

2. **JWT Authentication**: All API requests use JWT tokens for authentication, not Google tokens.

3. **localStorage**: User data in localStorage only contains non-sensitive fields (id, name, email, googleId, picture).

4. **HTTPS Required**: In production, ensure HTTPS is used for Google OAuth callbacks.

## Support

If Google authentication still doesn't work:

1. Check browser console for errors
2. Check backend logs: `tail -f /var/log/supervisor/backend.out.log`
3. Verify Google OAuth credentials in `.env` file
4. Ensure `GOOGLE_CALLBACK_URL` matches your registered redirect URI
5. Clear browser cache and localStorage completely
6. Test with a different Google account

## Success Indicators

✅ Profile button shows Google profile picture
✅ ProfileDropdown shows "Google Account" badge in blue
✅ Sync status shows "* Connected to Google Drive"
✅ Backup to Drive works without re-authentication
✅ Restore from Drive works without re-authentication
✅ Auto-sync service starts automatically (check backend logs)
✅ Google connection persists after page refresh
✅ Google connection persists after browser restart
✅ Works in Electron .exe build
