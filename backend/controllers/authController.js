const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fileManager = require('../services/fileManager');
const User = require('../models/User');
const googleAuthService = require('../services/googleAuthService');
const googleDriveService = require('../services/googleDriveService');
const autoSyncService = require('../services/autoSyncService');

class AuthController {
  // Register new user
  async register(req, res, next) {
    try {
      const { username, password, name, email, role } = req.body;

      // Check if users file exists
      let users = fileManager.readJSON('users.json') || [];

      // Check if user already exists
      const existingUser = users.find(u => u.username === username);
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user
      const newUser = new User({
        username,
        password: hashedPassword,
        name,
        email,
        role
      });

      users.push(newUser.toJSON());
      fileManager.writeJSON('users.json', users);

      // Generate JWT token
      const token = jwt.sign(
        { id: newUser.id, username: newUser.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          googleId: newUser.googleId,
          picture: newUser.picture
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Login user
  async login(req, res, next) {
    try {
      const { username, password } = req.body;

      // Get users
      const users = fileManager.readJSON('users.json') || [];

      // Find user
      const user = users.find(u => u.username === username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          googleId: user.googleId,
          picture: user.picture
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Logout (client-side token removal)
  async logout(req, res) {
    res.json({ message: 'Logout successful' });
  }

  // Verify token
  async verify(req, res) {
    try {
      const users = fileManager.readJSON('users.json') || [];
      const user = users.find(u => u.id === req.user.id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('Verify endpoint - User from DB:', {
        id: user.id,
        googleId: user.googleId,
        picture: user.picture
      });

      res.json({
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          googleId: user.googleId,
          picture: user.picture,
          // Don't send tokens or password to frontend for security
        }
      });
    } catch (error) {
      console.error('Verify endpoint error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  // Google OAuth Callback
  async googleCallback(req, res, next) {
    try {
      const googleUser = req.user;
      
      console.log('🔐 Google OAuth Callback - Google User:', {
        googleId: googleUser?.googleId,
        email: googleUser?.email,
        name: googleUser?.name,
        picture: googleUser?.picture
      });
      
      if (!googleUser) {
        return res.redirect(`${process.env.FRONTEND_URL}/#/?error=auth_failed`);
      }

      let users = fileManager.readJSON('users.json') || [];
      
      // Find or create user
      let user = users.find(u => u.email === googleUser.email);
      
      if (!user) {
        // Create new user from Google profile
        const newUser = new User({
          username: googleUser.email.split('@')[0],
          email: googleUser.email,
          name: googleUser.name,
          role: 'User',
          googleId: googleUser.googleId,
          picture: googleUser.picture,
          password: '' // No password for Google users
        });
        
        users.push(newUser.toJSON());
        user = newUser.toJSON();
        console.log('✅ Created new Google user with ID:', user.id);
      } else {
        // Always update Google info to ensure it's current
        user.googleId = googleUser.googleId;
        user.picture = googleUser.picture;
        user.name = googleUser.name || user.name; // Update name if provided
        console.log('✅ Updated existing user with Google info, ID:', user.id);
      }
      
      // Save Google tokens - update all fields in one go
      user.googleAccessToken = googleUser.accessToken;
      user.googleRefreshToken = googleUser.refreshToken;
      
      // Update the users array with the complete user object
      users = users.map(u => u.id === user.id ? user : u);
      fileManager.writeJSON('users.json', users);
      
      console.log('✅ User saved with googleId:', user.googleId, 'picture:', user.picture);

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username || user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      // Redirect to callback page (will handle popup vs normal flow)
      res.redirect(`${process.env.FRONTEND_URL}/#/callback?token=${token}&auth=google`);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/#/callback?error=server_error`);
    }
  }

  // Sync data to Google Drive
  async syncToGoogleDrive(req, res, next) {
    try {
      let users = fileManager.readJSON('users.json') || [];
      let user = users.find(u => u.id === req.user.id);

      if (!user || !user.googleRefreshToken) {
        return res.status(401).json({ 
          error: 'Google authentication required',
          message: 'Please sign in with Google to enable Drive sync'
        });
      }

      // Check if user recently restored (within 5 minutes) - warn but allow
      if (user.lastRestoreTime) {
        const restoreTime = new Date(user.lastRestoreTime);
        const now = new Date();
        const minutesSinceRestore = (now - restoreTime) / (1000 * 60);
        
        if (minutesSinceRestore < 5) {
          console.log(`⚠️ User ${user.email || user.username} syncing ${Math.round(minutesSinceRestore)} minutes after restore`);
          // Still allow but log warning - user explicitly requested sync
        }
      }

      // Refresh token if access token is missing or expired
      let accessToken = user.googleAccessToken;
      let refreshToken = user.googleRefreshToken;

      try {
        // Try to refresh the access token
        const refreshedTokens = await googleAuthService.refreshAccessToken(refreshToken);
        accessToken = refreshedTokens.accessToken;
        refreshToken = refreshedTokens.refreshToken;

        // Update user with new tokens
        user.googleAccessToken = accessToken;
        user.googleRefreshToken = refreshToken;
        users = users.map(u => u.id === user.id ? user : u);
        fileManager.writeJSON('users.json', users);
        
        console.log(`✅ Tokens refreshed for user: ${user.email || user.username}`);
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError.message);
        return res.status(401).json({ 
          error: 'Google authentication expired',
          message: 'Please sign in with Google again to continue syncing'
        });
      }

      // Create OAuth2 client with refreshed tokens
      const auth = googleAuthService.getOAuth2Client(accessToken, refreshToken);

      // Perform sync
      const result = await googleDriveService.syncToGoogleDrive(auth, user.id);
      
      console.log(`✅ Data synced to Google Drive for user: ${user.email || user.username}`);
      
      res.json({
        success: true,
        message: 'Data synced to Google Drive successfully',
        ...result
      });
    } catch (error) {
      console.error('❌ Sync error:', error);
      res.status(500).json({ 
        error: 'Sync failed',
        message: error.message || 'Failed to sync data to Google Drive'
      });
    }
  }

  // Get sync status
  async getSyncStatus(req, res, next) {
    try {
      let users = fileManager.readJSON('users.json') || [];
      let user = users.find(u => u.id === req.user.id);

      if (!user || !user.googleRefreshToken) {
        return res.json({ 
          synced: false, 
          connected: false,
          message: 'Not connected to Google Drive',
          autoSync: autoSyncService.getStatus()
        });
      }

      // Refresh token if needed
      let accessToken = user.googleAccessToken;
      let refreshToken = user.googleRefreshToken;

      try {
        const refreshedTokens = await googleAuthService.refreshAccessToken(refreshToken);
        accessToken = refreshedTokens.accessToken;
        refreshToken = refreshedTokens.refreshToken;

        // Update user with new tokens
        user.googleAccessToken = accessToken;
        user.googleRefreshToken = refreshToken;
        users = users.map(u => u.id === user.id ? user : u);
        fileManager.writeJSON('users.json', users);
      } catch (refreshError) {
        console.error('❌ Token refresh failed in getSyncStatus:', refreshError.message);
        return res.json({ 
          synced: false,
          connected: false, 
          message: 'Google authentication expired. Please sign in again.',
          autoSync: autoSyncService.getStatus()
        });
      }

      const auth = googleAuthService.getOAuth2Client(accessToken, refreshToken);
      const status = await googleDriveService.getSyncStatus(auth);
      
      res.json({
        synced: true,
        connected: true,
        ...status,
        autoSync: autoSyncService.getStatus()
      });
    } catch (error) {
      console.error('❌ Get sync status error:', error);
      res.json({ 
        synced: false,
        connected: false,
        message: 'Failed to get sync status',
        error: error.message,
        autoSync: autoSyncService.getStatus()
      });
    }
  }

  // Get auto-sync service status
  async getAutoSyncStatus(req, res) {
    try {
      const status = autoSyncService.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Restore data from Google Drive
  async restoreFromGoogleDrive(req, res, next) {
    try {
      let users = fileManager.readJSON('users.json') || [];
      let user = users.find(u => u.id === req.user.id);

      if (!user || !user.googleRefreshToken) {
        return res.status(401).json({ 
          error: 'Google authentication required',
          message: 'Please sign in with Google to restore from Drive'
        });
      }

      // Refresh token if needed
      let accessToken = user.googleAccessToken;
      let refreshToken = user.googleRefreshToken;

      try {
        const refreshedTokens = await googleAuthService.refreshAccessToken(refreshToken);
        accessToken = refreshedTokens.accessToken;
        refreshToken = refreshedTokens.refreshToken;

        // Update user with new tokens
        user.googleAccessToken = accessToken;
        user.googleRefreshToken = refreshToken;
        users = users.map(u => u.id === user.id ? user : u);
        fileManager.writeJSON('users.json', users);
        
        console.log(`✅ Tokens refreshed for restore: ${user.email || user.username}`);
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError.message);
        return res.status(401).json({ 
          error: 'Google authentication expired',
          message: 'Please sign in with Google again to restore data'
        });
      }

      // Create OAuth2 client
      const auth = googleAuthService.getOAuth2Client(accessToken, refreshToken);

      // Perform restore
      const result = await googleDriveService.restoreFromGoogleDrive(auth, user.id);
      
      if (result.success) {
        console.log(`✅ Data restored from Google Drive for user: ${user.email || user.username}`);
        res.json({
          success: true,
          message: 'Data restored from Google Drive successfully',
          ...result
        });
      } else {
        res.status(404).json({
          success: false,
          message: result.message || 'No backup found to restore'
        });
      }
    } catch (error) {
      console.error('❌ Restore error:', error);
      res.status(500).json({ 
        error: 'Restore failed',
        message: error.message || 'Failed to restore data from Google Drive'
      });
    }
  }
}

module.exports = new AuthController();
