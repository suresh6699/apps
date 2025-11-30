const fileManager = require('./fileManager');
const googleAuthService = require('./googleAuthService');
const googleDriveService = require('./googleDriveService');

class AutoSyncService {
  constructor() {
    this.syncInterval = null;
    this.SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
    this.isRunning = false;
  }

  // Start auto-sync for all users with Google Drive enabled
  start() {
    if (this.isRunning) {
      console.log('⚠️ Auto-sync service is already running');
      return;
    }

    console.log('🚀 Starting auto-sync service (15-minute interval)...');
    this.isRunning = true;

    // Set up recurring sync (removed initial 1-minute sync)
    this.syncInterval = setInterval(() => {
      this.syncAllUsers();
    }, this.SYNC_INTERVAL_MS);

    console.log('✅ Auto-sync service started successfully');
  }

  // Stop auto-sync
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.isRunning = false;
      console.log('🛑 Auto-sync service stopped');
    }
  }

  // Sync data for all users who have Google Drive connected
  async syncAllUsers() {
    try {
      console.log('\n📊 ===== Auto-Sync Starting =====');
      console.log(`⏰ Time: ${new Date().toLocaleString()}`);

      const users = fileManager.readJSON('users.json') || [];
      const usersWithDrive = users.filter(u => u.googleRefreshToken);

      if (usersWithDrive.length === 0) {
        console.log('ℹ️ No users with Google Drive connected');
        console.log('📊 ===== Auto-Sync Complete =====\n');
        return;
      }

      console.log(`👥 Found ${usersWithDrive.length} user(s) with Google Drive enabled`);

      for (const user of usersWithDrive) {
        await this.syncUser(user);
      }

      console.log('📊 ===== Auto-Sync Complete =====\n');
    } catch (error) {
      console.error('❌ Error in syncAllUsers:', error.message);
    }
  }

  // Sync data for a single user with token refresh handling
  async syncUser(user) {
    const userIdentifier = user.email || user.username || user.id;
    
    try {
      console.log(`\n🔄 Syncing user: ${userIdentifier}`);

      if (!user.googleRefreshToken) {
        console.log(`⚠️ User ${userIdentifier} has no refresh token, skipping...`);
        return;
      }

      // Skip sync if user recently restored (within 30 minutes)
      if (user.lastRestoreTime) {
        const restoreTime = new Date(user.lastRestoreTime);
        const now = new Date();
        const minutesSinceRestore = (now - restoreTime) / (1000 * 60);
        
        if (minutesSinceRestore < 30) {
          console.log(`⏭️ Skipping sync for user ${userIdentifier} - restored ${Math.round(minutesSinceRestore)} minutes ago`);
          return;
        }
      }

      let accessToken = user.googleAccessToken;
      let refreshToken = user.googleRefreshToken;
      let tokensUpdated = false;

      // Check if we need to refresh the access token
      try {
        console.log(`🔑 Refreshing access token for user: ${userIdentifier}`);
        const refreshedTokens = await googleAuthService.refreshAccessToken(refreshToken);
        accessToken = refreshedTokens.accessToken;
        refreshToken = refreshedTokens.refreshToken;
        tokensUpdated = true;

        console.log(`✅ Access token refreshed successfully for user: ${userIdentifier}`);
      } catch (refreshError) {
        console.error(`❌ Token refresh failed for user ${userIdentifier}:`, refreshError.message);
        
        // If token refresh fails, the user needs to re-authenticate
        console.log(`⚠️ User ${userIdentifier} needs to re-authenticate with Google`);
        return;
      }

      // Update user tokens in the file if they were refreshed
      if (tokensUpdated) {
        try {
          const users = fileManager.readJSON('users.json') || [];
          const updatedUsers = users.map(u => {
            if (u.id === user.id) {
              return {
                ...u,
                googleAccessToken: accessToken,
                googleRefreshToken: refreshToken,
                lastTokenRefresh: new Date().toISOString()
              };
            }
            return u;
          });
          fileManager.writeJSON('users.json', updatedUsers);
          console.log(`💾 Updated tokens saved for user: ${userIdentifier}`);
        } catch (saveError) {
          console.error(`❌ Failed to save updated tokens for user ${userIdentifier}:`, saveError.message);
        }
      }

      // Create OAuth2 client with refreshed tokens
      const auth = googleAuthService.getOAuth2Client(accessToken, refreshToken);

      // Perform sync to Google Drive
      console.log(`⬆️ Starting Google Drive upload for user: ${userIdentifier}`);
      const result = await googleDriveService.syncToGoogleDrive(auth, user.id);

      if (result.success) {
        console.log(`✅ Successfully synced for user ${userIdentifier}`);
        console.log(`   📁 File: ${result.fileName}`);
        console.log(`   🆔 File ID: ${result.fileId}`);
      } else {
        console.log(`⚠️ Sync completed with warnings for user ${userIdentifier}`);
      }
    } catch (error) {
      console.error(`❌ Sync failed for user ${userIdentifier}:`, error.message);
      
      // Check if it's a token-related error
      if (error.message.includes('invalid_grant') || 
          error.message.includes('Token has been expired') ||
          error.message.includes('unauthorized')) {
        console.log(`🔒 Authentication error for user ${userIdentifier} - re-authentication required`);
      }
    }
  }

  // Get sync service status
  getStatus() {
    return {
      running: this.isRunning,
      intervalMinutes: this.SYNC_INTERVAL_MS / 60000,
      nextSyncIn: this.isRunning ? 'Every 15 minutes' : 'Service stopped'
    };
  }
}

module.exports = new AutoSyncService();
