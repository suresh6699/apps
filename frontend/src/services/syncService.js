import api from './api';

class SyncService {
  constructor() {
    this.syncInterval = null;
    this.syncIntervalTime = 5 * 60 * 1000; // 5 minutes
  }

  // Start automatic sync when online
  startAutoSync() {
    // Stop any existing sync interval
    this.stopAutoSync();

    // Don't do initial sync - just setup periodic sync
    // This prevents multiple backups when called multiple times during login/auth
    console.log('🔄 Auto-sync started - will sync every 5 minutes');

    // Setup periodic sync
    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.syncToGoogleDrive();
      }
    }, this.syncIntervalTime);

    // Listen for online event
    window.addEventListener('online', this.handleOnline);
  }

  // Stop automatic sync
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    window.removeEventListener('online', this.handleOnline);
  }

  // Handle online event
  handleOnline = () => {
    console.log('Internet connection restored. Syncing data...');
    this.syncToGoogleDrive();
  }

  // Sync data to Google Drive
  async syncToGoogleDrive() {
    try {
      const user = localStorage.getItem('user');
      if (!user) {
        console.log('⚠️ No user found, skipping sync');
        return { success: false, message: 'No user found' };
      }

      const userData = JSON.parse(user);
      
      // Only sync if user has Google authentication
      if (!userData.googleId) {
        console.log('⚠️ User not authenticated with Google, skipping sync');
        return { success: false, message: 'Not authenticated with Google' };
      }

      console.log('🔄 Starting Google Drive sync...');
      const response = await api.post('/api/auth/sync-drive');
      
      if (response.data.success) {
        console.log('✅ Data synced to Google Drive:', response.data);
        
        // Update last sync time
        const syncTime = new Date().toISOString();
        localStorage.setItem('lastSyncTime', syncTime);
        localStorage.setItem('lastSyncStatus', 'success');
        
        return response.data;
      } else {
        console.warn('⚠️ Sync completed with warnings:', response.data);
        localStorage.setItem('lastSyncStatus', 'warning');
        return response.data;
      }
    } catch (error) {
      console.error('❌ Sync to Google Drive failed:', error.response?.data || error.message);
      localStorage.setItem('lastSyncStatus', 'error');
      
      // Check if it's an authentication error
      if (error.response?.status === 401) {
        console.error('🔐 Google authentication expired. User needs to sign in again.');
        return { 
          success: false, 
          authExpired: true,
          message: 'Google authentication expired' 
        };
      }
      
      // Don't throw error to prevent disrupting user experience
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  // Get sync status
  async getSyncStatus() {
    try {
      const response = await api.get('/api/auth/sync-status');
      return response.data;
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return { synced: false, message: 'Failed to get sync status' };
    }
  }

  // Get last sync time
  getLastSyncTime() {
    return localStorage.getItem('lastSyncTime');
  }

  // Restore data from Google Drive
  async restoreFromGoogleDrive() {
    try {
      const user = localStorage.getItem('user');
      if (!user) {
        return { success: false, message: 'No user found' };
      }

      const userData = JSON.parse(user);
      
      // Only restore if user has Google authentication
      if (!userData.googleId) {
        return { success: false, message: 'Not authenticated with Google', authExpired: true };
      }

      console.log('🔄 Starting Google Drive restore...');
      const response = await api.post('/api/auth/restore-drive');
      
      if (response.data.success) {
        console.log('✅ Data restored from Google Drive:', response.data);
        
        // Update last restore time
        const restoreTime = new Date().toISOString();
        localStorage.setItem('lastRestoreTime', restoreTime);
        
        return response.data;
      } else {
        console.warn('⚠️ Restore failed:', response.data);
        return response.data;
      }
    } catch (error) {
      console.error('❌ Restore from Google Drive failed:', error.response?.data || error.message);
      
      // Check if it's an authentication error
      if (error.response?.status === 401) {
        console.error('🔐 Google authentication expired. User needs to sign in again.');
        return { 
          success: false, 
          authExpired: true,
          message: 'Google authentication expired' 
        };
      }
      
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }
}

export default new SyncService();
