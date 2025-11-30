const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');

class GoogleDriveService {
  constructor() {
    this.FOLDER_NAME = 'SmartLog_Finance_Backup';
  }

  // Get Drive client
  getDriveClient(auth) {
    return google.drive({ version: 'v3', auth });
  }

  // Find or create backup folder
  async findOrCreateFolder(drive, folderName = this.FOLDER_NAME) {
    try {
      // Search for existing folder
      const response = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      if (response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      // Create folder if not exists
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };

      const folder = await drive.files.create({
        resource: folderMetadata,
        fields: 'id'
      });

      return folder.data.id;
    } catch (error) {
      console.error('Error finding/creating folder:', error);
      throw error;
    }
  }

  // Sync local data to Google Drive
  async syncToGoogleDrive(auth, userId) {
    let zipPath = null;
    try {
      console.log(`🔄 Starting Google Drive sync for user: ${userId}`);
      
      const drive = this.getDriveClient(auth);
      const folderId = await this.findOrCreateFolder(drive);
      console.log(`📁 Using folder ID: ${folderId}`);

      const dataPath = path.join(__dirname, '../data');
      
      // Create a zip of the data folder
      zipPath = path.join(__dirname, `../temp_backup_${userId}.zip`);
      console.log(`📦 Creating backup zip...`);
      await this.zipDirectory(dataPath, zipPath);

      // Create filename with date and time in IST format
      const now = new Date();
      // Convert to IST (UTC+5:30)
      const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
      const istDate = new Date(now.getTime() + istOffset);
      const dateStr = istDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = istDate.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS
      const backupFileName = `backup_${dateStr}_${timeStr}_IST.zip`;

      // Upload to Google Drive
      const fileMetadata = {
        name: backupFileName,
        parents: [folderId]
      };

      const media = {
        mimeType: 'application/zip',
        body: fs.createReadStream(zipPath)
      };

      console.log(`⬆️ Uploading backup to Google Drive: ${backupFileName}`);
      const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, createdTime'
      });

      // Implement rotation: Keep only 5 most recent backups
      console.log(`🔍 Checking for old backups to rotate...`);
      const allBackups = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false and name contains '.zip'`,
        orderBy: 'createdTime desc',
        fields: 'files(id, name, createdTime, mimeType)',
        spaces: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: 'user'
      });

      const backupFiles = allBackups.data.files;
      console.log(`📊 Total backups found: ${backupFiles.length}`);

      // If more than 5 backups, delete the oldest ones
      if (backupFiles.length > 5) {
        const filesToDelete = backupFiles.slice(5); // Keep first 5 (most recent), delete rest
        console.log(`🗑️ Deleting ${filesToDelete.length} old backup(s)...`);
        
        for (const fileToDelete of filesToDelete) {
          try {
            await drive.files.delete({
              fileId: fileToDelete.id
            });
            console.log(`   ✓ Deleted: ${fileToDelete.name}`);
          } catch (deleteError) {
            console.error(`   ✗ Failed to delete ${fileToDelete.name}:`, deleteError.message);
          }
        }
      }

      // Clean up temp zip file
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
        console.log(`🧹 Cleaned up temp file`);
      }

      console.log(`✅ Sync completed successfully: ${file.data.name}`);

      return {
        success: true,
        fileId: file.data.id,
        fileName: file.data.name,
        createdTime: file.data.createdTime,
        totalBackups: Math.min(backupFiles.length + 1, 5)
      };
    } catch (error) {
      console.error('❌ Error syncing to Google Drive:', error.message);
      
      // Clean up temp zip file on error
      if (zipPath && fs.existsSync(zipPath)) {
        try {
          fs.unlinkSync(zipPath);
          console.log(`🧹 Cleaned up temp file after error`);
        } catch (cleanupError) {
          console.error('Failed to cleanup temp file:', cleanupError.message);
        }
      }
      
      // Check for token-related errors
      if (error.message.includes('invalid_grant') || 
          error.message.includes('Token has been expired') ||
          error.message.includes('unauthorized') ||
          error.message.includes('Invalid Credentials') ||
          error.code === 401 || 
          error.code === 403) {
        throw new Error('Google authentication expired. Please sign in again.');
      }
      
      throw new Error(`Google Drive sync failed: ${error.message}`);
    }
  }

  // Restore data from Google Drive
  async restoreFromGoogleDrive(auth, userId) {
    let zipPath = null;
    let tempExtractPath = null;
    
    try {
      console.log(`🔄 Starting restore from Google Drive for user: ${userId}`);
      
      const drive = this.getDriveClient(auth);
      const folderId = await this.findOrCreateFolder(drive);

      // Find latest backup - search by name pattern instead of mimeType for better compatibility
      console.log(`📁 Searching in folder: ${this.FOLDER_NAME} (ID: ${folderId})`);
      
      // First, let's list ALL files in the folder to debug
      console.log(`🔍 Debug: Listing ALL files in backup folder...`);
      const allFilesInFolder = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        orderBy: 'createdTime desc',
        pageSize: 20,
        fields: 'files(id, name, createdTime, mimeType, size)',
        spaces: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: 'user'
      });
      
      console.log(`📊 Total files in folder: ${allFilesInFolder.data.files.length}`);
      if (allFilesInFolder.data.files.length > 0) {
        console.log(`📋 All files in backup folder:`);
        allFilesInFolder.data.files.forEach((file, index) => {
          console.log(`   ${index + 1}. "${file.name}" | Type: ${file.mimeType} | Size: ${file.size} bytes | Created: ${file.createdTime}`);
        });
      }
      
      // Now search for zip files - using multiple approaches
      let response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        orderBy: 'createdTime desc',
        pageSize: 20,
        fields: 'files(id, name, createdTime, mimeType, parents, size)',
        spaces: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: 'user'
      });
      
      // Filter for .zip files manually (more reliable than Google's query)
      const zipFiles = response.data.files.filter(file => 
        file.name.toLowerCase().endsWith('.zip') || 
        file.mimeType === 'application/zip' ||
        file.mimeType === 'application/x-zip-compressed'
      );
      
      response.data.files = zipFiles;
      console.log(`📊 Found ${zipFiles.length} .zip file(s) after filtering`);
      
      // If no backups found in the folder, search in root/My Drive as fallback
      if (zipFiles.length === 0) {
        console.log(`🔍 No backups in folder, searching entire Google Drive...`);
        const globalResponse = await drive.files.list({
          q: `trashed=false`,
          orderBy: 'createdTime desc',
          pageSize: 100,
          fields: 'files(id, name, createdTime, mimeType, parents, size)',
          spaces: 'drive',
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          corpora: 'user'
        });
        
        console.log(`📊 Total files in Google Drive: ${globalResponse.data.files.length}`);
        
        // Show first 20 files for debugging
        if (globalResponse.data.files.length > 0) {
          console.log(`📋 First 20 files in Google Drive:`);
          globalResponse.data.files.slice(0, 20).forEach((file, index) => {
            console.log(`   ${index + 1}. "${file.name}" | Type: ${file.mimeType} | Size: ${file.size || 'N/A'} bytes`);
          });
        } else {
          console.log(`⚠️ Google Drive appears to be completely empty!`);
          console.log(`💡 Please check:`);
          console.log(`   1. You're signed in with the correct Google account`);
          console.log(`   2. The file was uploaded successfully`);
          console.log(`   3. You have granted Drive access permissions`);
        }
        
        // Filter for zip files with 'backup' in name
        const globalZipFiles = globalResponse.data.files.filter(file => 
          file.name.toLowerCase().includes('backup') && 
          (file.name.toLowerCase().endsWith('.zip') || 
           file.mimeType === 'application/zip' ||
           file.mimeType === 'application/x-zip-compressed')
        );
        
        response.data.files = globalZipFiles;
        console.log(`📊 Found ${globalZipFiles.length} backup file(s) matching criteria`);
      }

      if (response.data.files.length > 0) {
        console.log(`📋 Available backups:`);
        response.data.files.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file.name} (${file.mimeType}) - ${file.createdTime}`);
        });
      }

      if (response.data.files.length === 0) {
        console.log(`⚠️ No backup found in Google Drive`);
        console.log(`💡 Please ensure .zip backup files with 'backup' in filename exist`);
        console.log(`💡 Recommended: Upload to '${this.FOLDER_NAME}' folder`);
        return { success: false, message: 'No backup found in Google Drive. Please upload a backup file with "backup" in the filename.' };
      }

      const latestBackup = response.data.files[0];
      console.log(`📥 Found backup: ${latestBackup.name}`);
      
      zipPath = path.join(__dirname, `../temp_restore_${userId}.zip`);

      // Download backup
      console.log(`⬇️ Downloading backup...`);
      const dest = fs.createWriteStream(zipPath);
      const driveResponse = await drive.files.get(
        { fileId: latestBackup.id, alt: 'media' },
        { responseType: 'stream' }
      );

      await new Promise((resolve, reject) => {
        driveResponse.data
          .pipe(dest)
          .on('finish', resolve)
          .on('error', reject);
      });

      console.log(`✅ Backup downloaded successfully`);

      // Extract to temporary directory first
      tempExtractPath = path.join(__dirname, `../temp_restore_extract_${userId}`);
      if (!fs.existsSync(tempExtractPath)) {
        fs.mkdirSync(tempExtractPath, { recursive: true });
      }

      console.log(`📦 Extracting backup to temporary location...`);
      await fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: tempExtractPath }))
        .promise();

      console.log(`✅ Backup extracted successfully`);

      // Backup current users.json to preserve authentication
      const dataPath = path.join(__dirname, '../data');
      const usersJsonPath = path.join(dataPath, 'users.json');
      let currentUsers = null;
      
      if (fs.existsSync(usersJsonPath)) {
        console.log(`💾 Preserving current users.json...`);
        currentUsers = fs.readFileSync(usersJsonPath, 'utf8');
      }

      // Clear the data directory (except we'll restore users.json after)
      console.log(`🗑️ Clearing current data directory...`);
      this.clearDirectory(dataPath);

      // Copy all extracted files to data directory
      console.log(`📋 Copying restored files to data directory...`);
      this.copyDirectoryRecursive(tempExtractPath, dataPath);

      // Restore users.json to preserve authentication AND mark restore timestamp
      if (currentUsers) {
        console.log(`🔐 Restoring users.json to preserve authentication...`);
        const usersData = JSON.parse(currentUsers);
        
        // Mark this user's restore timestamp to prevent immediate auto-sync
        const updatedUsers = usersData.map(u => {
          if (u.id === userId) {
            return {
              ...u,
              lastRestoreTime: new Date().toISOString()
            };
          }
          return u;
        });
        
        fs.writeFileSync(usersJsonPath, JSON.stringify(updatedUsers, null, 2));
        console.log(`🔐 Users.json restored with restore timestamp for user: ${userId}`);
      }

      // Clean up temp files
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
      if (fs.existsSync(tempExtractPath)) {
        this.clearDirectory(tempExtractPath);
        fs.rmdirSync(tempExtractPath);
      }

      console.log(`✅ Restore completed successfully: ${latestBackup.name}`);

      return {
        success: true,
        fileName: latestBackup.name,
        createdTime: latestBackup.createdTime
      };
    } catch (error) {
      console.error('❌ Error restoring from Google Drive:', error.message);
      
      // Clean up temp files on error
      if (zipPath && fs.existsSync(zipPath)) {
        try {
          fs.unlinkSync(zipPath);
        } catch (cleanupError) {
          console.error('Failed to cleanup zip file:', cleanupError.message);
        }
      }
      
      if (tempExtractPath && fs.existsSync(tempExtractPath)) {
        try {
          this.clearDirectory(tempExtractPath);
          fs.rmdirSync(tempExtractPath);
        } catch (cleanupError) {
          console.error('Failed to cleanup temp extract directory:', cleanupError.message);
        }
      }
      
      throw error;
    }
  }

  // Helper function to clear directory contents
  clearDirectory(directory) {
    if (!fs.existsSync(directory)) {
      return;
    }

    const files = fs.readdirSync(directory);
    for (const file of files) {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        this.clearDirectory(filePath);
        fs.rmdirSync(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }

  // Helper function to copy directory recursively
  copyDirectoryRecursive(source, destination) {
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    const files = fs.readdirSync(source);
    for (const file of files) {
      const sourcePath = path.join(source, file);
      const destPath = path.join(destination, file);
      const stat = fs.statSync(sourcePath);

      if (stat.isDirectory()) {
        this.copyDirectoryRecursive(sourcePath, destPath);
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }
    }
  }

  // Helper function to zip directory
  zipDirectory(sourceDir, outPath) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(outPath);

    return new Promise((resolve, reject) => {
      archive
        .directory(sourceDir, false)
        .on('error', err => reject(err))
        .pipe(stream);

      stream.on('close', () => resolve());
      archive.finalize();
    });
  }

  // Get sync status
  async getSyncStatus(auth) {
    try {
      const drive = this.getDriveClient(auth);
      const folderId = await this.findOrCreateFolder(drive);

      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false and name contains '.zip'`,
        orderBy: 'createdTime desc',
        pageSize: 5,
        fields: 'files(id, name, createdTime, size, mimeType)',
        spaces: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: 'user'
      });

      console.log(`📊 getSyncStatus - Found ${response.data.files.length} backup(s)`);
      response.data.files.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.name} (${file.mimeType})`);
      });

      return {
        success: true,
        backups: response.data.files
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      throw error;
    }
  }
}

module.exports = new GoogleDriveService();
