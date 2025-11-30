import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Mail, CloudUpload } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { useAuth } from '../contexts/AuthContext';
import syncService from '../services/syncService';
import { API_URL } from '../services/api';

const ProfileDropdownWithSync = ({ theme }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');
  const [googlePopup, setGooglePopup] = useState(null);

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      setSyncMessage('Syncing...');
      
      const result = await syncService.syncToGoogleDrive();
      
      // Check if authentication is required
      if (result.authExpired || result.message === 'Google authentication required') {
        setSyncMessage('');
        setIsSyncing(false);
        
        // Store current location to return after auth
        sessionStorage.setItem('returnAfterAuth', window.location.hash || '#/dashboard');
        
        // Open Google OAuth in popup
        const googleAuthUrl = API_URL 
          ? `${API_URL}/api/auth/google`
          : '/api/auth/google';
        
        openGooglePopup(googleAuthUrl);
        return;
      }
      
      if (result.success) {
        setSyncMessage('✅ Synced!');
        setTimeout(() => setSyncMessage(''), 3000);
      } else {
        setSyncMessage(result.message || '⚠️ Sync failed');
        setTimeout(() => setSyncMessage(''), 4000);
      }
    } catch (error) {
      console.error('Manual sync error:', error);
      setSyncMessage('❌ Sync error');
      setTimeout(() => setSyncMessage(''), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      setRestoreMessage('Restoring...');
      
      const result = await syncService.restoreFromGoogleDrive();
      
      // Check if authentication is required
      if (result.authExpired || result.message === 'Google authentication required' || result.message === 'Not authenticated with Google') {
        setRestoreMessage('');
        setIsRestoring(false);
        
        // Store current location to return after auth
        sessionStorage.setItem('returnAfterAuth', window.location.hash || '#/dashboard');
        
        // Open Google OAuth in popup
        const googleAuthUrl = API_URL 
          ? `${API_URL}/api/auth/google`
          : '/api/auth/google';
        
        openGooglePopup(googleAuthUrl);
        return;
      }
      
      if (result.success) {
        setRestoreMessage('✅ Restored!');
        setTimeout(() => {
          setRestoreMessage('');
          // Reload page to show restored data
          window.location.reload();
        }, 2000);
      } else {
        setRestoreMessage(result.message || '⚠️ No backup found');
        setTimeout(() => setRestoreMessage(''), 4000);
      }
    } catch (error) {
      console.error('Restore error:', error);
      setRestoreMessage('❌ Restore failed');
      setTimeout(() => setRestoreMessage(''), 3000);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/');
  };

  // Open Google OAuth in popup window
  const openGooglePopup = (url) => {
    // Calculate center position
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    // Open popup
    const popup = window.open(
      url,
      'Google Sign In',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );
    
    if (!popup) {
      setSyncMessage('⚠️ Please allow popups');
      setTimeout(() => setSyncMessage(''), 3000);
      return;
    }
    
    setGooglePopup(popup);
    
    // Focus popup
    popup.focus();
    
    // Listen for auth completion
    const messageHandler = async (event) => {
      // Security check
      const allowedOrigins = [
        window.location.origin,
        API_URL,
        'http://localhost:3000',
        'http://localhost:8001'
      ].filter(Boolean);

      if (!allowedOrigins.some(origin => event.origin === origin || event.origin.includes(origin))) {
        return;
      }

      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        console.log('ProfileDropdown - Received GOOGLE_AUTH_SUCCESS');
        
        // Send acknowledgment back to popup
        if (popup && !popup.closed) {
          try {
            popup.postMessage({ type: 'GOOGLE_AUTH_ACK' }, '*');
          } catch (err) {
            console.error('Error sending ACK to popup:', err);
          }
          popup.close();
        }
        
        // Store the token from the message
        if (event.data.token) {
          localStorage.setItem('token', event.data.token);
          
          // Fetch fresh user data from backend to get googleId and picture
          fetch(API_URL ? `${API_URL}/api/auth/verify` : '/api/auth/verify', {
            headers: {
              'Authorization': `Bearer ${event.data.token}`
            }
          })
            .then(res => res.json())
            .then(data => {
              console.log('ProfileDropdown - Fresh user data received:', data);
              console.log('ProfileDropdown - User googleId:', data.user?.googleId);
              console.log('ProfileDropdown - User picture:', data.user?.picture);
              
              if (data.user) {
                // Update localStorage with fresh user data including googleId
                localStorage.setItem('user', JSON.stringify(data.user));
                console.log('ProfileDropdown - User updated with googleId:', data.user.googleId);
                console.log('ProfileDropdown - User has Google connection:', !!data.user.googleId);
                
                // Dispatch event to notify AuthContext
                window.dispatchEvent(new CustomEvent('auth:refresh'));
              }
              
              // Give a moment for the popup to close and state to update, then reload
              setTimeout(() => {
                console.log('ProfileDropdown - Reloading to update auth state');
                window.location.reload();
              }, 500);
            })
            .catch(err => {
              console.error('ProfileDropdown - Error fetching user data:', err);
              // Reload anyway
              setTimeout(() => {
                window.location.reload();
              }, 500);
            });
        } else {
          // No token, just reload
          setTimeout(() => {
            console.log('ProfileDropdown - Reloading to update auth state');
            window.location.reload();
          }, 500);
        }
      }
    };

    window.addEventListener('message', messageHandler);

    // Check if popup was closed
    const popupCheckInterval = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(popupCheckInterval);
        window.removeEventListener('message', messageHandler);
        setGooglePopup(null);
      }
    }, 500);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          data-testid="profile-button"
          className={`relative w-10 h-10 rounded-full transition-all duration-300 hover:ring-4 focus:ring-4 outline-none ${
            theme === 'dark'
              ? 'hover:ring-cyan-500/30 focus:ring-cyan-500/30'
              : 'hover:ring-cyan-400/40 focus:ring-cyan-400/40'
          }`}
        >
          {user?.picture ? (
            <img 
              src={user.picture} 
              alt="Profile" 
              className="w-full h-full rounded-full border-2 border-cyan-500/50 object-cover"
            />
          ) : (
            <div className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold uppercase border-2 ${
              theme === 'dark'
                ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white border-cyan-500/50'
                : 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white border-cyan-400/50'
            }`}>
              {user?.username?.charAt(0) || user?.name?.charAt(0) || 'U'}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        data-testid="profile-dropdown"
        className={`w-64 p-0 shadow-2xl border-2 ${
          theme === 'dark'
            ? 'bg-slate-800/95 backdrop-blur-xl border-slate-600'
            : 'bg-white/95 backdrop-blur-xl border-slate-200'
        }`}
        align="end"
        sideOffset={12}
      >
        {/* Profile Header */}
        <div className={`p-4 border-b ${
          theme === 'dark' ? 'border-slate-600' : 'border-slate-200'
        }`}>
          <div className="flex items-center space-x-3">
            {user?.picture ? (
              <img 
                src={user.picture} 
                alt="Profile" 
                className="w-12 h-12 rounded-full border-2 border-cyan-500/50 object-cover"
              />
            ) : (
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold uppercase ${
                theme === 'dark'
                  ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white'
                  : 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white'
              }`}>
                {user?.username?.charAt(0) || user?.name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                {user?.name || user?.username || 'User'}
              </p>
              {user?.email && (
                <p className={`text-xs truncate flex items-center mt-0.5 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <Mail className="w-3 h-3 mr-1" />
                  {user.email}
                </p>
              )}
              {user?.googleId && (
                <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 ${
                  theme === 'dark'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  Google Account
                </span>
              )}
            </div>
          </div>
        </div>

        <DropdownMenuSeparator className={theme === 'dark' ? 'bg-slate-600' : 'bg-slate-200'} />

        {/* Manual Sync Button */}
        <div className="p-2">
          <DropdownMenuItem
            data-testid="manual-sync-button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className={`cursor-pointer px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
              theme === 'dark'
                ? 'hover:bg-blue-950/50 focus:bg-blue-950/50 text-blue-400'
                : 'hover:bg-blue-50 focus:bg-blue-50 text-blue-600'
            } ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <CloudUpload className={`w-4 h-4 ${isSyncing ? 'animate-pulse' : ''}`} />
            <div className="flex-1 flex items-center justify-between">
              <span className="font-semibold text-sm">
                {isSyncing ? 'Syncing...' : 'Backup to Drive'}
              </span>
              {syncMessage && (
                <span className="text-xs ml-2">
                  {syncMessage}
                </span>
              )}
            </div>
          </DropdownMenuItem>
          <p className={`text-[10px] px-4 mt-1 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
          }`}>
            {user?.googleId 
              ? '* Connected to Google Drive' 
              : '* Click to sign in with Google'}
          </p>
        </div>

        {/* Restore Button */}
        <div className="p-2">
          <DropdownMenuItem
            data-testid="restore-button"
            onClick={handleRestore}
            disabled={isRestoring}
            className={`cursor-pointer px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
              theme === 'dark'
                ? 'hover:bg-green-950/50 focus:bg-green-950/50 text-green-400'
                : 'hover:bg-green-50 focus:bg-green-50 text-green-600'
            } ${isRestoring ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg 
              className={`w-4 h-4 ${isRestoring ? 'animate-pulse' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" 
              />
            </svg>
            <div className="flex-1 flex items-center justify-between">
              <span className="font-semibold text-sm">
                {isRestoring ? 'Restoring...' : 'Restore from Drive'}
              </span>
              {restoreMessage && (
                <span className="text-xs ml-2">
                  {restoreMessage}
                </span>
              )}
            </div>
          </DropdownMenuItem>
          <p className={`text-[10px] px-4 mt-1 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
          }`}>
            {user?.googleId 
              ? '* Connected to Google Drive' 
              : '* Click to sign in with Google'}
          </p>
        </div>

        <DropdownMenuSeparator className={theme === 'dark' ? 'bg-slate-600' : 'bg-slate-200'} />

        {/* Sign Out */}
        <div className="p-2">
          <DropdownMenuItem
            data-testid="sign-out-button"
            onClick={handleSignOut}
            className={`cursor-pointer px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
              theme === 'dark'
                ? 'hover:bg-red-950/50 focus:bg-red-950/50 text-red-400'
                : 'hover:bg-red-50 focus:bg-red-50 text-red-600'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span className="font-semibold text-sm">Sign Out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdownWithSync;
