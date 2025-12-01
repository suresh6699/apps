const fs = require('fs');
const path = require('path');

class FileManager {
  constructor() {
    // Use DATA_PATH from environment (set by Electron in production) or default to development path
    this.dataDir = process.env.DATA_PATH || path.join(__dirname, '../data');
    // console.log('📂 Data directory:', this.dataDir);
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    const dirs = [
      this.dataDir,
      path.join(this.dataDir, 'customers'),
      path.join(this.dataDir, 'deleted_customers'),
      path.join(this.dataDir, 'transactions'),
      path.join(this.dataDir, 'transactions_deleted'),
      path.join(this.dataDir, 'chat'),
      path.join(this.dataDir, 'chat_deleted'),
      path.join(this.dataDir, 'renewals'),
      path.join(this.dataDir, 'renewals_deleted'),
      path.join(this.dataDir, 'accounts'),
      path.join(this.dataDir, 'account_transactions'),
      path.join(this.dataDir, 'days')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  readJSON(filePath) {
    try {
      const fullPath = path.join(this.dataDir, filePath);
      if (fs.existsSync(fullPath)) {
        const data = fs.readFileSync(fullPath, 'utf8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      // console.error(`Error reading ${filePath}:`, error);
      return null;
    }
  }

  writeJSON(filePath, data) {
    try {
      const fullPath = path.join(this.dataDir, filePath);
      const dir = path.dirname(fullPath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      // console.error(`Error writing ${filePath}:`, error);
      return false;
    }
  }

  deleteJSON(filePath) {
    try {
      const fullPath = path.join(this.dataDir, filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      return true;
    } catch (error) {
      // console.error(`Error deleting ${filePath}:`, error);
      return false;
    }
  }

  listFiles(directory) {
    try {
      const fullPath = path.join(this.dataDir, directory);
      if (fs.existsSync(fullPath)) {
        return fs.readdirSync(fullPath);
      }
      return [];
    } catch (error) {
      // console.error(`Error listing files in ${directory}:`, error);
      return [];
    }
  }
}

module.exports = new FileManager();
