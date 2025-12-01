const express = require('express');
const router = express.Router();
const passport = require('passport');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const validate = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');

// Register
router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  validate,
  authController.register
);

// Login
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  validate,
  authController.login
);

// Logout
router.post('/logout', authMiddleware, authController.logout);

// Verify token
router.get('/verify', authMiddleware, authController.verify);

// Google OAuth Routes
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive'],
    accessType: 'offline',
    prompt: 'consent'
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: process.env.FRONTEND_URL || 'http://localhost:3000',
    session: false 
  }),
  authController.googleCallback
);

// Google Drive Sync Routes
router.post('/sync-drive', authMiddleware, authController.syncToGoogleDrive);
router.post('/restore-drive', authMiddleware, authController.restoreFromGoogleDrive);
router.get('/sync-status', authMiddleware, authController.getSyncStatus);
router.get('/auto-sync-status', authMiddleware, authController.getAutoSyncStatus);

module.exports = router;
