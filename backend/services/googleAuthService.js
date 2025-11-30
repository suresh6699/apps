const { google } = require('googleapis');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

class GoogleAuthService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );
  }

  // Initialize Passport Google Strategy
  initializePassport() {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL,
          scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive'],
          accessType: 'offline',
          prompt: 'consent'
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const user = {
              googleId: profile.id,
              email: profile.emails[0].value,
              name: profile.displayName,
              picture: profile.photos[0]?.value,
              accessToken,
              refreshToken
            };
            return done(null, user);
          } catch (error) {
            return done(error, null);
          }
        }
      )
    );

    passport.serializeUser((user, done) => {
      done(null, user);
    });

    passport.deserializeUser((user, done) => {
      done(null, user);
    });
  }

  // Get OAuth2 client with user's tokens
  getOAuth2Client(accessToken, refreshToken) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );

    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    return client;
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken) {
    try {
      const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALLBACK_URL
      );

      client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await client.refreshAccessToken();
      
      console.log('✅ Google access token refreshed successfully');
      
      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep old one
        expiryDate: credentials.expiry_date
      };
    } catch (error) {
      console.error('❌ Failed to refresh Google access token:', error.message);
      throw new Error('Failed to refresh Google access token');
    }
  }

  // Get OAuth2 client with automatic token refresh
  async getOAuth2ClientWithRefresh(accessToken, refreshToken, onTokenRefresh) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );

    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    // Set up automatic token refresh
    client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        console.log('🔄 New refresh token received');
      }
      if (tokens.access_token) {
        console.log('🔄 New access token received');
        // Callback to save new tokens
        if (onTokenRefresh) {
          onTokenRefresh({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || refreshToken
          });
        }
      }
    });

    return client;
  }
}

module.exports = new GoogleAuthService();
