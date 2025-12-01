const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const session = require('express-session');
const fileManager = require('./services/fileManager');
const googleAuthService = require('./services/googleAuthService');
const autoSyncService = require('./services/autoSyncService');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.JWT_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
googleAuthService.initializePassport();

// Import routes
const authRoutes = require('./routes/auth');
const lineRoutes = require('./routes/lines');
const customerRoutes = require('./routes/customers');
const transactionRoutes = require('./routes/transactions');
const collectionRoutes = require('./routes/collections');
const accountRoutes = require('./routes/accounts');
const dayRoutes = require('./routes/days');
const pdfRoutes = require('./routes/pdf');

// ✅ Auto-create admin user if users.json is missing or empty
async function initializeAdminUser() {
  try {
    let users = fileManager.readJSON('users.json');
    
    if (!users || users.length === 0) {
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      users = [{
        id: Date.now().toString(),
        username: 'admin',
        password: hashedPassword,
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'Super Admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];
      
      fileManager.writeJSON('users.json', users);
    } else {
    }
  } catch (error) {
  }
}

// Initialize admin user before starting server
initializeAdminUser().then(() => {
  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/lines', lineRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/collections', collectionRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/days', dayRoutes);
  app.use('/api/pdf', pdfRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Finance API is running' });
  });

  // Error handling middleware
  const errorHandler = require('./middleware/errorHandler');
  app.use(errorHandler);

  // Start server
  app.listen(PORT, () => {
    console.log(`✅ Finance API server running on port ${PORT}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Start auto-sync service for Google Drive
    console.log('\n🔄 Initializing Google Drive auto-sync service...');
    autoSyncService.start();
  });
});

module.exports = app;
