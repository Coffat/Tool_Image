import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { registerIpcHandlers } from './ipc/imageIpc';
import { AppAutoUpdater } from './services/autoUpdater';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-image',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const preloadCjs = path.join(__dirname, 'preload.cjs');
  const preloadJs = path.join(__dirname, 'preload.js');
  const preloadPath = fs.existsSync(preloadCjs) ? preloadCjs : preloadJs;
  console.log('[Main Process] Resolved preload path:', preloadPath, 'Exists:', fs.existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 750,
    title: 'Phương Nam Product Studio - Thuốc Thú Y Phương Nam',
    backgroundColor: '#F8FAFC',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: false, // needed for preload to access electron ipcRenderer
    },
  });

  // Register IPC handlers
  registerIpcHandlers(mainWindow);

  // Initialize Auto Updater
  AppAutoUpdater.getInstance().init(mainWindow);

  // Load dev server or production build
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Register custom protocol handler for local images
  protocol.handle('local-image', async (request) => {
    try {
      const parsed = new URL(request.url);
      let decodedPath = '';
      if (parsed.hostname === 'local-file') {
        const rawPath = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
        decodedPath = decodeURIComponent(rawPath);
      } else {
        const raw = request.url.replace(/^local-image:\/\//, '').split('?')[0];
        decodedPath = decodeURIComponent(raw);
        if (!decodedPath.startsWith('/') && process.platform !== 'win32') {
          decodedPath = '/' + decodedPath;
        }
      }

      if (!fs.existsSync(decodedPath)) {
        console.error('[Protocol local-image] File does not exist:', decodedPath);
        return new Response('File not found', { status: 404 });
      }

      const res = await net.fetch(pathToFileURL(decodedPath).toString());
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    } catch (err) {
      console.error('[Protocol local-image] Error serving image:', request.url, err);
      return new Response('Internal Protocol Error', { status: 500 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
