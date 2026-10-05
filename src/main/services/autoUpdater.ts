import { app, BrowserWindow, ipcMain } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

export class AppAutoUpdater {
  private static instance: AppAutoUpdater | null = null;
  private mainWindow: BrowserWindow | null = null;

  public static getInstance(): AppAutoUpdater {
    if (!AppAutoUpdater.instance) {
      AppAutoUpdater.instance = new AppAutoUpdater();
    }
    return AppAutoUpdater.instance;
  }

  public init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    // Configure updater logger and options
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Checking for updates on GitHub...');
      this.sendToRenderer('updater:status', { status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[AutoUpdater] New version available:', info.version);
      this.sendToRenderer('updater:status', {
        status: 'available',
        version: info.version,
        releaseDate: info.releaseDate,
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[AutoUpdater] App is up to date:', info.version);
      this.sendToRenderer('updater:status', {
        status: 'not-available',
        version: info.version,
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.sendToRenderer('updater:progress', {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[AutoUpdater] Update downloaded:', info.version);
      this.sendToRenderer('updater:status', {
        status: 'downloaded',
        version: info.version,
      });
    });

    autoUpdater.on('error', (err) => {
      console.warn('[AutoUpdater] Update error (non-fatal):', err.message);
      this.sendToRenderer('updater:status', {
        status: 'error',
        error: err.message,
      });
    });

    // Register IPC triggers
    ipcMain.handle('updater:check', async () => {
      if (!app.isPackaged) {
        console.log('[AutoUpdater] Running in development mode; skipping check.');
        return { status: 'dev-mode' };
      }
      try {
        const result = await autoUpdater.checkForUpdates();
        return result;
      } catch (err: any) {
        return { status: 'error', error: err.message };
      }
    });

    ipcMain.handle('updater:quitAndInstall', () => {
      autoUpdater.quitAndInstall();
    });

    // Automatically check for updates on startup if packaged
    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
          console.warn('[AutoUpdater] Startup update check failed:', err.message);
        });
      }, 5000);
    }
  }

  private sendToRenderer(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
