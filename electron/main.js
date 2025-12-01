const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess;
let oauthWindow;

const BACKEND_PORT = 8001;
const FRONTEND_PORT = 3000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // ✅ CRITICAL FIX: Added preload script
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'icon.ico'), // ✅ FIXED: Removed 'electron' from path
    backgroundColor: '#ffffff',
    show: false,
    title: 'Finance Manager'
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('✅ Window ready and shown');
  });

  if (isDev) {
    console.log('🔧 Running in DEVELOPMENT mode');
    mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
    mainWindow.webContents.openDevTools();
  } else {
    console.log('📦 Running in PRODUCTION mode');
    console.log('📍 __dirname:', __dirname);
    console.log('📍 app.getAppPath():', app.getAppPath());
    
    // ✅ FIXED: Added '..' to go up from electron/ folder
    const indexPath = path.join(__dirname, '..', 'frontend', 'build', 'index.html');
    
    console.log('🔍 Loading from:', indexPath);
    console.log('📁 File exists:', fs.existsSync(indexPath));
    
    mainWindow.loadFile(indexPath)
      .then(() => {
        console.log('✅ Frontend loaded successfully');
      })
      .catch(err => {
        console.error('❌ Failed to load frontend:', err);
        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Error - Finance Manager</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
                  padding: 60px;
                  text-align: center;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  margin: 0;
                  height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
                .container {
                  background: rgba(255,255,255,0.1);
                  padding: 40px;
                  border-radius: 20px;
                  backdrop-filter: blur(10px);
                }
                h1 { font-size: 32px; margin-bottom: 20px; }
                p { font-size: 16px; margin-bottom: 30px; opacity: 0.9; }
                button {
                  background: white;
                  color: #667eea;
                  border: none;
                  padding: 12px 30px;
                  font-size: 16px;
                  border-radius: 8px;
                  cursor: pointer;
                  font-weight: 600;
                }
                button:hover { transform: scale(1.05); }
                .error-details {
                  margin-top: 20px;
                  padding: 15px;
                  background: rgba(0,0,0,0.2);
                  border-radius: 8px;
                  font-size: 12px;
                  font-family: monospace;
                  text-align: left;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>⚠️ Application Error</h1>
                <p>Could not load the application files.</p>
                <button onclick="location.reload()">Retry</button>
                <div class="error-details">
                  <strong>Error:</strong> ${err.message}<br>
                  <strong>Path:</strong> ${indexPath}<br>
                  <strong>Please rebuild the app with:</strong> npm run package:dir
                </div>
              </div>
            </body>
          </html>
        `));
      });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer] ${message}`);
  });
}

// Handle OAuth popup
function createOAuthWindow(url) {
  if (oauthWindow) {
    oauthWindow.focus();
    return;
  }

  oauthWindow = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    parent: mainWindow,
    modal: false,
    show: false,
    title: 'Sign in with Google'
  });

  oauthWindow.once('ready-to-show', () => {
    oauthWindow.show();
  });

  oauthWindow.loadURL(url);

  // Intercept navigation to callback URL
  oauthWindow.webContents.on('will-redirect', (event, url) => {
    handleOAuthCallback(url);
  });

  oauthWindow.webContents.on('did-navigate', (event, url) => {
    handleOAuthCallback(url);
  });

  oauthWindow.on('closed', () => {
    oauthWindow = null;
  });
}

// Handle OAuth callback
function handleOAuthCallback(url) {
  const urlObj = new URL(url);
  
  // Check if this is a callback URL
  if (urlObj.hash.includes('/callback')) {
    const hashParams = urlObj.hash.split('?')[1];
    if (hashParams) {
      const params = new URLSearchParams(hashParams);
      const token = params.get('token');
      const authType = params.get('auth');
      const error = params.get('error');

      if (token && authType === 'google') {
        // Success - send to main window
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('google-auth-success', { token });
        }
        
        // Close OAuth window
        if (oauthWindow && !oauthWindow.isDestroyed()) {
          oauthWindow.close();
        }
      } else if (error) {
        // Error - notify main window
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('google-auth-error', { error });
        }
        
        // Close OAuth window
        if (oauthWindow && !oauthWindow.isDestroyed()) {
          oauthWindow.close();
        }
      }
    }
  }
}

// IPC handler for opening OAuth window
ipcMain.on('open-google-auth', (event, url) => {
  createOAuthWindow(url);
});

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Refresh',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function startBackend() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting backend server...');
    
    // ✅ CRITICAL FIX: Set DATA_PATH to userData directory
    const userDataPath = app.getPath('userData');
    const dataPath = path.join(userDataPath, 'data');
    
    console.log('💾 User data will be stored at:', dataPath);
    
    let backendPath;
    if (isDev) {
      backendPath = path.join(__dirname, '..', 'backend'); // ✅ FIXED: Added '..'
    } else {
      // Backend is in extraResources
      backendPath = path.join(process.resourcesPath, 'backend');
      console.log('📂 Backend path:', backendPath);
      
      if (!fs.existsSync(backendPath)) {
        console.error('❌ Backend not found at:', backendPath);
        reject(new Error('Backend files not found'));
        return;
      }
    }

    const serverScript = path.join(backendPath, 'server.js');
    
    if (!fs.existsSync(serverScript)) {
      console.error('❌ server.js not found at:', serverScript);
      reject(new Error('Backend server.js not found'));
      return;
    }

    console.log('📄 Server script:', serverScript);

    // ✅ FIXED: Hide console window on Windows
    const spawnOptions = {
      cwd: backendPath,
      env: {
        ...process.env,
        PORT: BACKEND_PORT,
        NODE_ENV: isDev ? 'development' : 'production',
        DATA_PATH: dataPath // ✅ CRITICAL: Pass user data path to backend
      },
      // ✅ Change stdio to 'pipe' to capture output without showing console
      stdio: isDev ? 'inherit' : 'pipe',
      // ✅ Hide window on Windows
      windowsHide: true,
      // ✅ Detached process (runs in background)
      detached: false
    };

    backendProcess = spawn('node', [serverScript], spawnOptions);

    // ✅ In production, capture and log output without showing console
    if (!isDev && backendProcess.stdout) {
      backendProcess.stdout.on('data', (data) => {
        console.log(`[Backend] ${data.toString().trim()}`);
      });
    }

    if (!isDev && backendProcess.stderr) {
      backendProcess.stderr.on('data', (data) => {
        console.error(`[Backend Error] ${data.toString().trim()}`);
      });
    }

    backendProcess.on('error', (error) => {
      console.error('❌ Failed to start backend:', error);
      reject(error);
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`⚠️ Backend exited: code ${code}, signal ${signal}`);
    });

    // Wait for backend to start
    setTimeout(() => {
      console.log(`✅ Backend running on port ${BACKEND_PORT}`);
      resolve();
    }, 3000);
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('🛑 Stopping backend...');
    
    // ✅ Properly kill the process
    try {
      if (process.platform === 'win32') {
        // On Windows, use taskkill to ensure process is terminated
        spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
      } else {
        backendProcess.kill('SIGTERM');
      }
    } catch (err) {
      console.error('Error stopping backend:', err);
    }
    
    backendProcess = null;
  }
}

app.whenReady().then(async () => {
  try {
    console.log('🎬 App ready');
    console.log('📍 __dirname:', __dirname);
    console.log('📍 resourcesPath:', process.resourcesPath);
    console.log('📍 appPath:', app.getAppPath());
    console.log('📍 userData:', app.getPath('userData'));
    console.log('📍 isDev:', isDev);
    
    await startBackend();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('❌ Failed to start:', error);
    // Don't quit immediately, still show the window
    createWindow();
  }
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('will-quit', () => {
  stopBackend();
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
});

// ✅ Ensure backend is killed on exit
process.on('exit', () => {
  stopBackend();
});
