const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
  
  // Google OAuth popup handler for Electron
  openGoogleAuth: (url) => {
    ipcRenderer.send('open-google-auth', url);
  },
  
  // Listen for auth success/error from OAuth window
  onGoogleAuthSuccess: (callback) => {
    ipcRenderer.on('google-auth-success', (event, data) => callback(data));
  },
  onGoogleAuthError: (callback) => {
    ipcRenderer.on('google-auth-error', (event, data) => callback(data));
  }
});

// Expose environment info
contextBridge.exposeInMainWorld('env', {
  NODE_ENV: process.env.NODE_ENV || 'production'
});
