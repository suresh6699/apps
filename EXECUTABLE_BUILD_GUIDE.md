# How to Create Executable and Use the Application

## 📦 Building Desktop Application (EXE/DMG/AppImage)

This guide will help you create a standalone executable application that users can install and run on their computers.

---

## 🎯 Quick Start

### Prerequisites
Before building, ensure you have:
- **Node.js** (version 16 or higher) - [Download here](https://nodejs.org/)
- **Git** (optional, if cloning from repository)
- **Windows/macOS/Linux** computer

### Check Node.js Installation
```bash
node --version
npm --version
```

---

## 🛠️ Step-by-Step Build Process

### Step 1: Install Dependencies

First, install all required packages:

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
yarn install
cd ..
```

### Step 2: Test Application Locally (Optional but Recommended)

Before building, test that everything works:

```bash
npm start
```

This will:
- Start the backend server
- Start the React frontend
- Launch Electron window

**Default Login:**
- Username: `admin`
- Password: `admin123`

Press `Ctrl+C` to stop when done testing.

---

## 🚀 Build Executable

### Build for Your Current Operating System

Run this command from the root directory:

```bash
npm run package
```

This will automatically build for your current platform.

### Build for Specific Platforms

#### Windows Executable (.exe)
```bash
npm run package:win
```
**Output:** `dist/Finance Manager Setup 1.0.0.exe`

#### macOS Application (.dmg)
```bash
npm run package:mac
```
**Output:** `dist/Finance Manager-1.0.0.dmg`

#### Linux Application (.AppImage or .deb)
```bash
npm run package:linux
```
**Output:** `dist/Finance Manager-1.0.0.AppImage`

---

## 📂 Finding Your Executable

After building, your executable will be in the `dist/` folder:

```
finance-app-desktop/
├── dist/
│   ├── Finance Manager Setup 1.0.0.exe      (Windows)
│   ├── Finance Manager-1.0.0.dmg            (macOS)
│   ├── Finance Manager-1.0.0.AppImage       (Linux)
│   └── ...other build files
```

---

## 📥 Installing and Using the Application

### For Windows Users

1. **Locate the installer:**
   - Navigate to `dist/` folder
   - Find `Finance Manager Setup 1.0.0.exe`

2. **Install:**
   - Double-click the `.exe` file
   - Follow the installation wizard
   - Choose installation location (default is usually fine)
   - Click "Install"

3. **Run:**
   - Application will appear in Start Menu
   - Launch "Finance Manager"
   - Login with default credentials:
     - Username: `admin`
     - Password: `admin123`

### For macOS Users

1. **Locate the installer:**
   - Navigate to `dist/` folder
   - Find `Finance Manager-1.0.0.dmg`

2. **Install:**
   - Double-click the `.dmg` file
   - Drag the app to Applications folder
   - If you get a security warning, go to System Preferences → Security & Privacy → Open Anyway

3. **Run:**
   - Open Applications folder
   - Double-click "Finance Manager"
   - Login with default credentials

### For Linux Users

1. **Locate the installer:**
   - Navigate to `dist/` folder
   - Find `Finance Manager-1.0.0.AppImage` or `.deb`

2. **Install AppImage:**
   ```bash
   chmod +x "Finance Manager-1.0.0.AppImage"
   ./Finance\ Manager-1.0.0.AppImage
   ```

3. **Or Install .deb (Ubuntu/Debian):**
   ```bash
   sudo dpkg -i Finance\ Manager-1.0.0.deb
   ```

4. **Run:**
   - Launch from applications menu or command line
   - Login with default credentials

---

## 🎨 Customizing Before Building

### Change App Name

Edit `package.json` in root directory:
```json
{
  "name": "my-finance-app",
  "productName": "My Finance App",
  "version": "1.0.0"
}
```

### Change App Icon

1. Create icon files:
   - **Windows:** `electron/icon.ico` (256x256 pixels)
   - **macOS:** `electron/icon.icns` (512x512 pixels)
   - **Linux:** `electron/icon.png` (512x512 pixels)

2. Use online tools to create icons:
   - [icoconvert.com](https://icoconvert.com/)
   - [cloudconvert.com](https://cloudconvert.com/)

3. Replace icon files in `electron/` folder

### Change Default Login Credentials

Edit `backend/data/users.json` (create if doesn't exist):
```json
[
  {
    "id": "1",
    "username": "admin",
    "password": "your-hashed-password",
    "role": "admin"
  }
]
```

Or modify in `backend/controllers/authController.js`

---

## 🔧 Build Configuration

### Modify Build Settings

Edit `electron-builder.yml`:

```yaml
appId: com.yourcompany.financemanager
productName: Your Finance Manager
directories:
  buildResources: electron
  output: dist
files:
  - backend/**/*
  - frontend/build/**/*
  - electron/**/*
  - package.json
win:
  target: nsis
  icon: electron/icon.ico
mac:
  target: dmg
  icon: electron/icon.icns
  category: public.app-category.finance
linux:
  target: AppImage
  icon: electron/icon.png
  category: Finance
```

### Change Backend Port

If port 8001 is taken:

1. Edit `backend/.env`:
   ```env
   PORT=8001
   ```

2. Edit `frontend/.env`:
   ```env
   REACT_APP_API_URL=
   ```
   (Leave empty to use proxy configuration)

3. Edit `frontend/package.json`:
   ```json
   {
     "proxy": "http://localhost:8001"
   }
   ```

---

## 📦 Distribution

### Sharing Your Application

After building, you can share the executable:

**Windows:**
- Share `Finance Manager Setup 1.0.0.exe`
- Users just double-click to install

**macOS:**
- Share `Finance Manager-1.0.0.dmg`
- Users drag to Applications folder

**Linux:**
- Share `Finance Manager-1.0.0.AppImage`
- Users make executable and run

### Creating an Installer Package

The built executables ARE installers. Users can:
1. Download the file
2. Run/install it
3. Use the application immediately

No additional setup needed!

---

## 🐛 Troubleshooting Build Issues

### Build Fails

**Problem:** Error during build process

**Solutions:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear frontend cache
cd frontend
rm -rf node_modules yarn.lock
yarn install
cd ..

# Clear backend cache
cd backend
rm -rf node_modules package-lock.json
npm install
cd ..

# Try building again
npm run package
```

### "Cannot find module" Error

**Solution:** Make sure all dependencies are installed:
```bash
npm install
cd backend && npm install && cd ..
cd frontend && yarn install && cd ..
```

### Large File Size

The executable will be 150-300MB because it includes:
- Node.js runtime
- Electron framework
- All dependencies
- Application code

This is normal for Electron applications.

### Building on Different OS

- **Windows builds:** Best built on Windows
- **macOS builds:** Must be built on macOS (requires Xcode)
- **Linux builds:** Can be built on Linux or macOS

**Cross-platform building:** Limited support, may require additional tools.

---

## ✅ Testing Your Executable

After building:

1. **Install the application** from the `dist/` folder
2. **Launch the application**
3. **Test core features:**
   - Login with default credentials
   - Create a new line
   - Add customers
   - Record transactions
   - View collections
   - Export PDF reports
4. **Check data persistence:**
   - Close and reopen the app
   - Verify data is still there

---

## 📊 Application Features

Once installed, users can:

### Financial Management
- ✅ Create and manage financial lines
- ✅ Track customers and their transactions
- ✅ Record payments, expenses, and adjustments
- ✅ View daily collections
- ✅ Manage multiple accounts
- ✅ Transfer funds between accounts

### Reporting
- ✅ Generate PDF reports
- ✅ View Balance Forward (BF) calculations
- ✅ Track transaction history
- ✅ Export data

### User Features
- ✅ Secure login with JWT authentication
- ✅ Light/Dark theme support
- ✅ Responsive design
- ✅ Offline-first (works without internet)
- ✅ Local data storage (JSON files)

---

## 🔒 Security & Data

### Data Storage
- All data stored locally on user's computer
- Location: Application data folder
  - Windows: `%APPDATA%/Finance Manager/`
  - macOS: `~/Library/Application Support/Finance Manager/`
  - Linux: `~/.config/Finance Manager/`

### Backup Data
Users should regularly backup the data folder to prevent loss.

### Privacy
- No data sent to external servers
- Completely offline application
- User data stays on their computer

---

## 📝 Support & Updates

### Updating the Application

To release a new version:

1. Update version in `package.json`:
   ```json
   {
     "version": "1.1.0"
   }
   ```

2. Rebuild:
   ```bash
   npm run package
   ```

3. Distribute new executable

### Auto-Update (Optional)

To enable auto-updates, configure electron-builder with update server:
- Requires hosting update files
- See Electron Builder documentation for details

---

## 📞 Getting Help

If you encounter issues:

1. **Check logs:**
   - Windows: `%APPDATA%/Finance Manager/logs/`
   - macOS: `~/Library/Logs/Finance Manager/`
   - Linux: `~/.config/Finance Manager/logs/`

2. **Common issues:**
   - Port 8001 already in use → Change port in `.env`
   - App won't start → Check if Node.js is installed
   - Data not saving → Check folder permissions

3. **Clean reinstall:**
   - Uninstall application
   - Delete data folder
   - Reinstall from fresh executable

---

**Happy Building! 🚀**

For more details, see the main README.md file.
