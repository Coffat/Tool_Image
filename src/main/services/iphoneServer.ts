import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { app, BrowserWindow, shell } from 'electron';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { ZipArchive } from 'archiver';
import { ImageProcessor } from './imageProcessor';
import { ImageEnhancer } from './imageEnhancer';
import { ImageItem, IphoneSyncStatus, ExportedMobileItem } from '../../shared/types';
import { formatLocalImageUrl } from '../../shared/formatUrl';

export class IphoneServer {
  private static instance: IphoneServer | null = null;
  private server: http.Server | null = null;
  private port: number = 52188;
  private ip: string = '127.0.0.1';
  private mainWindow: BrowserWindow | null = null;
  private receivedCount: number = 0;
  private isRunning: boolean = false;
  private qrCodeDataUrl: string = '';
  private exportedItems: ExportedMobileItem[] = [];

  public static getInstance(): IphoneServer {
    if (!IphoneServer.instance) {
      IphoneServer.instance = new IphoneServer();
    }
    return IphoneServer.instance;
  }

  public getSavedFolder(): string {
    const todayStr = new Date().toISOString().slice(0, 10);
    const picturesPath = app.getPath('pictures') || path.join(os.homedir(), 'Pictures');
    const targetDir = path.join(picturesPath, 'PhuongNamStudio', 'iPhone_Uploads', todayStr);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    return targetDir;
  }

  public openSavedFolder(): void {
    const folder = this.getSavedFolder();
    shell.openPath(folder);
  }

  public registerExportedImages(paths: string[]): void {
    const validPaths = paths.filter((p) => p && fs.existsSync(p));
    for (const p of validPaths) {
      try {
        const stat = fs.statSync(p);
        const fileName = path.basename(p);
        const existingIdx = this.exportedItems.findIndex((it) => it.filePath === p);
        const item: ExportedMobileItem = {
          id: `export-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          filePath: p,
          fileName,
          fileSize: stat.size,
          exportTime: new Date().toLocaleTimeString('vi-VN'),
        };
        if (existingIdx !== -1) {
          this.exportedItems[existingIdx] = item;
        } else {
          this.exportedItems.unshift(item);
        }
      } catch (err) {
        console.warn('[IphoneServer] Failed to register exported item:', p, err);
      }
    }
    if (this.exportedItems.length > 100) {
      this.exportedItems = this.exportedItems.slice(0, 100);
    }
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('iphone:statusUpdate', this.getStatus());
    }
  }

  public getExportedItems(): ExportedMobileItem[] {
    return this.exportedItems;
  }

  private getLocalIpAddress(): string {
    const interfaces = os.networkInterfaces();
    const priorityNames = ['en0', 'en1', 'wlan0', 'eth0', 'wi-fi', 'wifi'];
    
    for (const name of priorityNames) {
      const iface = interfaces[name];
      if (iface) {
        for (const alias of iface) {
          if (alias.family === 'IPv4' && !alias.internal && alias.address !== '127.0.0.1') {
            return alias.address;
          }
        }
      }
    }

    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (iface) {
        for (const alias of iface) {
          if (alias.family === 'IPv4' && !alias.internal && alias.address !== '127.0.0.1') {
            return alias.address;
          }
        }
      }
    }

    return '127.0.0.1';
  }

  public async start(mainWindow: BrowserWindow): Promise<IphoneSyncStatus> {
    this.mainWindow = mainWindow;
    if (this.isRunning && this.server) {
      return this.getStatus();
    }

    this.ip = this.getLocalIpAddress();

    return new Promise((resolve, reject) => {
      const tryListen = (attemptPort: number) => {
        const srv = http.createServer((req, res) => this.handleRequest(req, res));

        srv.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.warn(`[IphoneServer] Port ${attemptPort} in use, trying next port...`);
            srv.close();
            tryListen(attemptPort + 1);
          } else {
            console.error('[IphoneServer] Server error:', err);
            this.isRunning = false;
            reject(err);
          }
        });

        srv.listen(attemptPort, '0.0.0.0', async () => {
          this.server = srv;
          this.port = attemptPort;
          this.isRunning = true;
          const url = `http://${this.ip}:${this.port}`;
          console.log(`[IphoneServer] Server running at ${url}`);

          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(url, {
              width: 320,
              margin: 2,
              color: {
                dark: '#002B49',
                light: '#FFFFFF',
              },
            });
          } catch (qrErr) {
            console.error('[IphoneServer] Error generating QR code:', qrErr);
          }

          resolve(this.getStatus());
        });
      };

      tryListen(this.port);
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          this.isRunning = false;
          console.log('[IphoneServer] Server stopped.');
          resolve();
        });
      } else {
        this.isRunning = false;
        resolve();
      }
    });
  }

  public getStatus(): IphoneSyncStatus {
    const url = `http://${this.ip}:${this.port}`;
    return {
      isRunning: this.isRunning,
      ip: this.ip,
      port: this.port,
      url,
      qrCodeDataUrl: this.qrCodeDataUrl,
      receivedCount: this.receivedCount,
      exportCount: this.exportedItems.length,
      savedFolder: this.getSavedFolder(),
    };
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && parsedUrl.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(this.getMobileUploadHtml());
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getStatus()));
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/api/exports') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, items: this.exportedItems }));
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/api/download-file') {
      this.handleDownloadFile(req, res, parsedUrl, true);
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/api/view-file') {
      this.handleDownloadFile(req, res, parsedUrl, false);
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/api/download-zip') {
      this.handleDownloadZip(req, res);
      return;
    }

    if (req.method === 'POST' && parsedUrl.pathname === '/api/upload') {
      this.handleUpload(req, res, parsedUrl);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  private handleDownloadFile(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    parsedUrl: URL,
    asAttachment: boolean
  ): void {
    const id = parsedUrl.searchParams.get('id');
    const targetItem = this.exportedItems.find((it) => it.id === id);

    if (!targetItem || !fs.existsSync(targetItem.filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'File không tồn tại hoặc đã bị xóa.' }));
      return;
    }

    const ext = path.extname(targetItem.filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';

    const stat = fs.statSync(targetItem.filePath);
    const headers: Record<string, string | number> = {
      'Content-Type': contentType,
      'Content-Length': stat.size,
    };

    if (asAttachment) {
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(targetItem.fileName)}"`;
    }

    res.writeHead(200, headers);
    fs.createReadStream(targetItem.filePath).pipe(res);
  }

  private handleDownloadZip(_req: http.IncomingMessage, res: http.ServerResponse): void {
    const validItems = this.exportedItems.filter((it) => fs.existsSync(it.filePath));
    if (validItems.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Chưa có ảnh nào được xuất để tải về.' }));
      return;
    }

    const zipName = `PhuongNam_ThanhPham_${new Date().toISOString().slice(0, 10)}.zip`;
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(zipName)}"`,
    });

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (err: any) => {
      console.error('[IphoneServer] Archive error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });

    archive.pipe(res);

    for (const item of validItems) {
      archive.file(item.filePath, { name: item.fileName });
    }

    archive.finalize();
  }

  private async handleUpload(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    parsedUrl: URL
  ): Promise<void> {
    try {
      const originalName =
        parsedUrl.searchParams.get('name') ||
        (req.headers['x-filename'] as string) ||
        `photo_${Date.now()}.jpg`;

      const decodedName = decodeURIComponent(originalName).replace(/[/\\?%*:|"<>]/g, '_');
      const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
      const uniqueName = `IPHONE_${timestamp}_${decodedName}`;

      const uploadFolder = this.getSavedFolder();
      const tempPath = path.join(uploadFolder, `temp_${Date.now()}_${uniqueName}`);

      const writeStream = fs.createWriteStream(tempPath);
      req.pipe(writeStream);

      writeStream.on('finish', async () => {
        try {
          const ext = path.extname(decodedName).toLowerCase();
          const isHeic = ext === '.heic' || ext === '.heif';
          const finalExt = isHeic ? '.jpg' : (ext || '.jpg');
          const finalBaseName = path.parse(uniqueName).name + finalExt;
          const finalFilePath = path.join(uploadFolder, finalBaseName);

          if (isHeic) {
            // High-quality HEIC conversion preserving crystal clear product text
            await sharp(tempPath)
              .rotate()
              .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
              .toFile(finalFilePath);
            fs.unlinkSync(tempPath);
          } else {
            try {
              // Check EXIF orientation
              const meta = await sharp(tempPath).metadata();
              if (!meta.orientation || meta.orientation === 1) {
                // Already correctly oriented -> Keep 100% untouched original binary file!
                fs.renameSync(tempPath, finalFilePath);
              } else {
                // Auto-orient camera shots with 100% max quality
                if (ext === '.png') {
                  await sharp(tempPath).rotate().png({ compressionLevel: 6 }).toFile(finalFilePath);
                } else if (ext === '.webp') {
                  await sharp(tempPath).rotate().webp({ quality: 100, lossless: true }).toFile(finalFilePath);
                } else {
                  await sharp(tempPath)
                    .rotate()
                    .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
                    .toFile(finalFilePath);
                }
                fs.unlinkSync(tempPath);
              }
            } catch (sharpErr) {
              // Fallback to direct rename if metadata read fails
              fs.renameSync(tempPath, finalFilePath);
            }
          }

          const meta = await ImageProcessor.getMetadata(finalFilePath);
          this.receivedCount += 1;
          console.log(`[IphoneServer] Uploaded: ${finalBaseName} -> ${meta.width}x${meta.height} px (${(meta.size / 1024).toFixed(1)} KB)`);

          const imageItem: ImageItem = {
            id: `iphone-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            filePath: finalFilePath,
            fileName: path.basename(finalFilePath),
            originalWidth: meta.width,
            originalHeight: meta.height,
            fileSize: meta.size,
            previewUrl: formatLocalImageUrl(finalFilePath),
            status: 'idle',
            suggestEnhance: ImageEnhancer.shouldSuggestEnhance(meta.width, meta.height),
            source: 'iphone',
            uploadTime: new Date().toLocaleTimeString('vi-VN'),
          };

          // Notify Desktop Renderer
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('iphone:newImages', [imageItem]);
            this.mainWindow.webContents.send('iphone:statusUpdate', this.getStatus());
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, item: imageItem }));
        } catch (err: any) {
          console.error('[IphoneServer] Error processing uploaded image:', err);
          if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch {}
          }
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      writeStream.on('error', (err) => {
        console.error('[IphoneServer] Write stream error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Write failed' }));
      });
    } catch (err: any) {
      console.error('[IphoneServer] Upload error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  private getMobileUploadHtml(): string {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Phương Nam Studio - Đồng Bộ Di Động</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background: linear-gradient(135deg, #091E3A 0%, #102B4E 50%, #064E3B 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 12px 40px;
      color: #FFFFFF;
    }
    .container {
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .header-card {
      text-align: center;
      padding: 8px 0;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.18);
      color: #A7F3D0;
      border: 1px solid rgba(16, 185, 129, 0.4);
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background-color: #10B981;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    h1 {
      font-size: 21px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.3px;
    }
    .sub {
      font-size: 12px;
      color: #94A3B8;
      margin-top: 3px;
    }

    /* Tab switcher */
    .tab-bar {
      display: flex;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 4px;
      gap: 4px;
    }
    .tab-btn {
      flex: 1;
      padding: 10px 12px;
      border-radius: 12px;
      border: none;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      color: #94A3B8;
      background: transparent;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .tab-btn.active {
      background: #FFFFFF;
      color: #0F172A;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }
    .tab-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 999px;
      background: #059669;
      color: white;
      font-weight: 800;
    }
    .tab-btn.active .tab-badge {
      background: #0F172A;
      color: #FFFFFF;
    }

    /* Card Panels */
    .panel {
      display: none;
      background: rgba(255, 255, 255, 0.98);
      color: #0F172A;
      border-radius: 24px;
      padding: 24px 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
    }
    .panel.active {
      display: block;
    }

    /* Quality notice banner */
    .quality-tip {
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 14px;
      padding: 12px 14px;
      margin-bottom: 20px;
      text-align: left;
      font-size: 12px;
      color: #1E40AF;
      line-height: 1.45;
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .quality-tip svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      color: #2563EB;
      margin-top: 1px;
    }

    .btn-main {
      width: 100%;
      padding: 16px 20px;
      border-radius: 16px;
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: #FFFFFF;
      font-size: 16px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 10px 20px -5px rgba(5, 150, 105, 0.5);
      transition: all 0.2s ease;
    }
    .btn-main:active {
      transform: scale(0.97);
      opacity: 0.92;
    }
    .btn-main svg {
      width: 22px;
      height: 22px;
    }
    .btn-sub {
      width: 100%;
      margin-top: 10px;
      padding: 13px 18px;
      border-radius: 14px;
      background: #F1F5F9;
      color: #1E293B;
      font-size: 13px;
      font-weight: 700;
      border: 1px solid #CBD5E1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
    }
    .btn-sub:active {
      background: #E2E8F0;
    }

    /* Modal Backdrop for Quality Alert */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal-box {
      background: #FFFFFF;
      color: #0F172A;
      border-radius: 20px;
      padding: 24px 20px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .modal-icon {
      font-size: 38px;
      margin-bottom: 8px;
    }
    .modal-title {
      font-size: 16px;
      font-weight: 800;
      color: #B45309;
      margin-bottom: 8px;
    }
    .modal-desc {
      font-size: 12px;
      color: #334155;
      line-height: 1.5;
      margin-bottom: 12px;
      text-align: left;
      background: #FFFBEB;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #FDE68A;
    }
    .modal-tip {
      font-size: 11px;
      color: #1E40AF;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      padding: 10px 12px;
      border-radius: 10px;
      text-align: left;
      margin-bottom: 18px;
      line-height: 1.45;
    }
    .modal-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .btn-fix {
      width: 100%;
      padding: 12px;
      border-radius: 12px;
      background: #059669;
      color: white;
      font-size: 13px;
      font-weight: 700;
      border: none;
      cursor: pointer;
    }
    .btn-ignore {
      width: 100%;
      padding: 10px;
      border-radius: 12px;
      background: transparent;
      color: #64748B;
      font-size: 12px;
      font-weight: 600;
      border: none;
      cursor: pointer;
    }

    /* Progress UI */
    .progress-box {
      display: none;
      margin-top: 20px;
      text-align: left;
    }
    .progress-bar-bg {
      width: 100%;
      height: 10px;
      background: #E2E8F0;
      border-radius: 999px;
      overflow: hidden;
      margin: 8px 0;
    }
    .progress-bar-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #10B981, #059669);
      border-radius: 999px;
      transition: width 0.25s ease;
    }
    .progress-text {
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      display: flex;
      justify-content: space-between;
    }

    /* Success UI */
    .success-box {
      display: none;
      margin-top: 20px;
      padding: 16px;
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      border-radius: 14px;
      color: #166534;
      text-align: center;
    }
    .success-box svg {
      width: 36px;
      height: 36px;
      margin-bottom: 6px;
      color: #16A34A;
    }
    .success-title {
      font-size: 15px;
      font-weight: 800;
    }
    .success-msg {
      font-size: 12px;
      color: #15803D;
      margin-top: 4px;
    }
    .btn-again {
      display: inline-block;
      margin-top: 12px;
      padding: 9px 18px;
      background: #16A34A;
      color: white;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
    }

    /* Download Tab Styles */
    .download-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .download-header h3 {
      font-size: 16px;
      font-weight: 800;
      color: #0F172A;
    }
    .btn-refresh {
      background: #F1F5F9;
      border: none;
      color: #475569;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .btn-zip {
      width: 100%;
      padding: 14px 18px;
      border-radius: 14px;
      background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 8px 16px -4px rgba(37, 99, 235, 0.4);
      margin-bottom: 16px;
      text-decoration: none;
    }
    .btn-zip:active {
      transform: scale(0.98);
    }
    .exports-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 480px;
      overflow-y: auto;
      padding-right: 2px;
    }
    .export-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      transition: all 0.15s ease;
    }
    .export-thumb {
      width: 58px;
      height: 58px;
      border-radius: 10px;
      background: #E2E8F0;
      object-fit: cover;
      flex-shrink: 0;
      cursor: pointer;
      border: 1px solid #CBD5E1;
    }
    .export-info {
      flex: 1;
      min-width: 0;
    }
    .export-name {
      font-size: 12px;
      font-weight: 700;
      color: #1E293B;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .export-meta {
      font-size: 10px;
      color: #64748B;
      margin-top: 2px;
    }
    .export-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex-shrink: 0;
    }
    .btn-save-item {
      padding: 7px 12px;
      border-radius: 8px;
      background: #059669;
      color: white;
      font-size: 11px;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      border: none;
    }
    .btn-preview-item {
      padding: 4px 8px;
      border-radius: 6px;
      background: #E2E8F0;
      color: #334155;
      font-size: 10px;
      font-weight: 600;
      text-decoration: none;
      text-align: center;
    }
    .empty-box {
      text-align: center;
      padding: 36px 12px;
      color: #94A3B8;
    }
    .empty-box svg {
      width: 44px;
      height: 44px;
      color: #CBD5E1;
      margin-bottom: 8px;
    }
    .empty-title {
      font-size: 14px;
      font-weight: 700;
      color: #64748B;
    }
    .empty-desc {
      font-size: 11px;
      color: #94A3B8;
      margin-top: 4px;
    }

    /* iOS Save Tip Banner */
    .ios-save-tip {
      background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
      border: 1px solid #F59E0B;
      border-radius: 14px;
      padding: 14px 14px;
      margin-bottom: 16px;
      text-align: left;
      font-size: 12px;
      color: #92400E;
      line-height: 1.5;
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .ios-save-tip .tip-icon {
      font-size: 24px;
      flex-shrink: 0;
    }
    .ios-save-tip strong {
      color: #B45309;
    }
    .ios-save-steps {
      margin-top: 6px;
      padding-left: 4px;
    }
    .ios-save-steps li {
      margin-top: 3px;
      list-style: none;
    }
    .ios-save-steps li::before {
      content: '➜ ';
    }

    /* Lightbox Modal */
    .lightbox {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 9999;
      padding: 20px;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .lightbox.active {
      display: flex;
    }
    .lightbox img {
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
      border-radius: 12px;
      -webkit-touch-callout: default;
      -webkit-user-select: auto;
      user-select: auto;
    }
    .lightbox-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .lightbox-hint {
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 700;
      margin-top: 16px;
      text-align: center;
      background: rgba(245, 158, 11, 0.25);
      border: 1px solid rgba(245, 158, 11, 0.6);
      padding: 12px 18px;
      border-radius: 12px;
      animation: hintPulse 2s ease-in-out infinite;
    }
    @keyframes hintPulse {
      0%, 100% { opacity: 0.85; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.03); }
    }
    .lightbox-hint em {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: #FDE68A;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header-card">
      <div class="badge">
        <div class="pulse-dot"></div>
        ĐÃ KẾT NỐI VỚI MÁY TÍNH
      </div>
      <h1>Phương Nam Studio</h1>
      <p class="sub">Đồng bộ ảnh siêu tốc giữa iPhone và máy tính</p>
    </div>

    <!-- Navigation Tabs -->
    <div class="tab-bar">
      <button id="tabUploadBtn" class="tab-btn active" onclick="switchTab('upload')">
        <span>📤 Gửi ảnh lên</span>
      </button>
      <button id="tabDownloadBtn" class="tab-btn" onclick="switchTab('download')">
        <span>📥 Nhận ảnh về</span>
        <span id="exportBadge" class="tab-badge" style="display: none;">0</span>
      </button>
    </div>

    <!-- Panel 1: Upload to Computer -->
    <div id="uploadPanel" class="panel active">
      <!-- High Quality Notice Tip -->
      <div class="quality-tip">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <strong>Mẹo chụp & chọn ảnh nét căng:</strong><br/>
          Khi chọn ảnh từ Thư viện iPhone, bấm nút <strong>Tùy chọn (Options)</strong> ở dưới cùng màn hình ➔ chọn <strong>Kích thước thực tế (Actual Size)</strong> để ảnh giữ nguyên độ phân giải gốc 12MP/48MP, đọc rõ từng dòng chữ nhỏ trên chai thuốc.
        </div>
      </div>

      <!-- Hidden native file inputs -->
      <input
        type="file"
        id="fileInputPhotos"
        multiple
        accept="image/*,image/heic,image/heif"
        style="display: none;"
      />
      <input
        type="file"
        id="fileInputFiles"
        multiple
        style="display: none;"
      />

      <div id="uploadBtnsGroup">
        <button id="uploadPhotosBtn" class="btn-main" onclick="document.getElementById('fileInputPhotos').click()">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          <span>📷 Chọn từ Thư viện ảnh (Photos)</span>
        </button>

        <button id="uploadFilesBtn" class="btn-sub" onclick="document.getElementById('fileInputFiles').click()">
          <svg style="width:18px;height:18px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
          </svg>
          <span>📁 Chọn từ Tệp gốc (Files / iCloud) - Tránh Nén 100%</span>
        </button>
      </div>

      <!-- Quality Warning Modal -->
      <div id="qualityModal" class="modal-backdrop" style="display: none;">
        <div class="modal-box">
          <div class="modal-icon">⚠️</div>
          <div class="modal-title">Cảnh báo: Ảnh bị iPhone nén mờ!</div>
          <div id="qualityDetails" class="modal-desc"></div>
          <div class="modal-tip">
            💡 <strong>Cách gửi ảnh 4K/24MP nét từng dòng chữ nhỏ:</strong><br/>
            1. Bấm <em>"Chọn lại ảnh nét gốc"</em> bên dưới.<br/>
            2. Ở màn hình Thư viện iPhone, bấm chữ <strong>Tùy chọn (Options)</strong> dưới đáy màn hình ➔ Đổi sang <strong>Kích thước thực tế (Actual Size)</strong>.<br/>
            <em>(Hoặc dùng nút "Chọn từ Tệp gốc" để bỏ qua hoàn toàn nén của iPhone)</em>
          </div>
          <div class="modal-buttons">
            <button class="btn-fix" onclick="closeQualityModal(true)">Chọn lại ảnh nét gốc</button>
            <button class="btn-ignore" onclick="closeQualityModal(false)">Vẫn tiếp tục gửi ảnh này</button>
          </div>
        </div>
      </div>

      <!-- Progress UI -->
      <div id="progressBox" class="progress-box">
        <div class="progress-text">
          <span id="progressLabel">Đang gửi ảnh chất lượng cao...</span>
          <span id="progressPercent">0%</span>
        </div>
        <div class="progress-bar-bg">
          <div id="progressBarFill" class="progress-bar-fill"></div>
        </div>
      </div>

      <!-- Success UI -->
      <div id="successBox" class="success-box">
        <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="success-title">Chuyển ảnh thành công!</div>
        <div id="successCount" class="success-msg">Đã nạp 0 ảnh vào Phương Nam Studio</div>
        <button class="btn-again" onclick="resetUI()">Gửi thêm ảnh khác</button>
      </div>
    </div>

    <!-- Panel 2: Download Processed Photos to Mobile -->
    <div id="downloadPanel" class="panel">
      <!-- iOS Save Instructions -->
      <div class="ios-save-tip">
        <span class="tip-icon">📲</span>
        <div>
          <strong>Cách lưu ảnh vào Thư viện iPhone:</strong>
          <ol class="ios-save-steps">
            <li>Bấm nút <strong>"Lưu vào Ảnh 📲"</strong> bên dưới</li>
            <li><strong>Chạm và giữ</strong> vào ảnh hiện ra</li>
            <li>Chọn <strong>"Lưu vào Ảnh"</strong> (Save to Photos)</li>
          </ol>
        </div>
      </div>

      <div class="download-header">
        <h3>Ảnh Thành Phẩm Đã Gắn Logo</h3>
        <button class="btn-refresh" onclick="fetchExports()">
          <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          Làm mới
        </button>
      </div>

      <div id="downloadZipContainer" style="display: none;">
        <a id="btnZip" href="/api/download-zip" class="btn-zip">
          <svg style="width:20px;height:20px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
          Tải Toàn Bộ Thành Phẩm (.ZIP)
        </a>
      </div>

      <div id="exportsList" class="exports-list">
        <!-- Rendered dynamically -->
      </div>
    </div>
  </div>

  <!-- Lightbox Modal for iPhone Fullscreen View & Save to Photos -->
  <div id="lightbox" class="lightbox" onclick="closeLightbox()">
    <button class="lightbox-close" onclick="closeLightbox()">✕</button>
    <img id="lightboxImg" src="" alt="Xem ảnh" onclick="event.stopPropagation()" style="-webkit-touch-callout: default;" />
    <div class="lightbox-hint" onclick="event.stopPropagation()">
      👆 <strong>Chạm và giữ vào ảnh</strong> → chọn <strong>"Lưu vào Ảnh"</strong>
      <em>Ảnh sẽ được lưu trực tiếp vào Thư viện ảnh (Photos) trên iPhone của bạn</em>
    </div>
  </div>

  <script>
    const fileInputPhotos = document.getElementById('fileInputPhotos');
    const fileInputFiles = document.getElementById('fileInputFiles');
    const uploadBtnsGroup = document.getElementById('uploadBtnsGroup');
    const progressBox = document.getElementById('progressBox');
    const progressLabel = document.getElementById('progressLabel');
    const progressPercent = document.getElementById('progressPercent');
    const progressBarFill = document.getElementById('progressBarFill');
    const successBox = document.getElementById('successBox');
    const successCount = document.getElementById('successCount');
    const qualityModal = document.getElementById('qualityModal');
    const qualityDetails = document.getElementById('qualityDetails');

    let pendingFiles = null;

    // Tab Navigation
    function switchTab(tab) {
      const isUpload = tab === 'upload';
      document.getElementById('tabUploadBtn').classList.toggle('active', isUpload);
      document.getElementById('tabDownloadBtn').classList.toggle('active', !isUpload);
      document.getElementById('uploadPanel').classList.toggle('active', isUpload);
      document.getElementById('downloadPanel').classList.toggle('active', !isUpload);
      if (!isUpload) {
        fetchExports();
      }
    }

    fileInputPhotos.addEventListener('change', (e) => handleFilesSelection(e.target.files));
    fileInputFiles.addEventListener('change', (e) => handleFilesSelection(e.target.files));

    async function handleFilesSelection(files) {
      if (!files || files.length === 0) return;
      const warnings = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const img = new Image();
          const objUrl = URL.createObjectURL(file);
          await new Promise((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = objUrl;
          });
          URL.revokeObjectURL(objUrl);

          const w = img.naturalWidth || 0;
          const h = img.naturalHeight || 0;
          const sizeKb = Math.round(file.size / 1024);

          // If image is under 2000px or size < 350KB, it is a compressed thumbnail
          if ((w > 0 && w < 2000 && h < 2000) || sizeKb < 350) {
            warnings.push({ name: file.name, w, h, sizeKb });
          }
        } catch (err) {}
      }

      if (warnings.length > 0) {
        pendingFiles = files;
        qualityDetails.innerHTML = warnings.map(w => 
          '• <strong>' + w.name + '</strong>: ' + (w.w ? w.w + '×' + w.h + ' px, ' : '') + w.sizeKb + ' KB (bị giảm độ nét)'
        ).join('<br/>');
        qualityModal.style.display = 'flex';
      } else {
        startUploadProcess(files);
      }
    }

    function closeQualityModal(shouldReselect) {
      qualityModal.style.display = 'none';
      if (shouldReselect) {
        resetUI();
      } else if (pendingFiles) {
        startUploadProcess(pendingFiles);
        pendingFiles = null;
      }
    }

    // Upload Handler
    async function startUploadProcess(files) {
      uploadBtnsGroup.style.display = 'none';
      successBox.style.display = 'none';
      progressBox.style.display = 'block';

      const total = files.length;
      let completed = 0;

      for (let i = 0; i < total; i++) {
        const file = files[i];
        progressLabel.innerText = 'Đang gửi ' + (i + 1) + '/' + total + ' ảnh (' + file.name + ')...';
        
        try {
          const resp = await fetch('/api/upload?name=' + encodeURIComponent(file.name), {
            method: 'POST',
            body: file,
            headers: {
              'Content-Type': 'application/octet-stream',
              'X-Filename': encodeURIComponent(file.name)
            }
          });
          if (resp.ok) {
            completed++;
          }
        } catch (err) {
          console.error('Upload failed for file', file.name, err);
        }

        const percent = Math.round(((i + 1) / total) * 100);
        progressPercent.innerText = percent + '%';
        progressBarFill.style.width = percent + '%';
      }

      progressBox.style.display = 'none';
      successCount.innerText = 'Đã chuyển thành công ' + completed + ' ảnh gốc sắc nét sang máy tính!';
      successBox.style.display = 'block';

      if (navigator.vibrate) {
        navigator.vibrate([80, 50, 80]);
      }
    }

    function resetUI() {
      fileInputPhotos.value = '';
      fileInputFiles.value = '';
      uploadBtnsGroup.style.display = 'block';
      progressBox.style.display = 'none';
      successBox.style.display = 'none';
      progressBarFill.style.width = '0%';
      document.getElementById('fileInputPhotos').click();
    }

    // Download/Exports Fetcher
    async function fetchExports() {
      try {
        const resp = await fetch('/api/exports');
        const data = await resp.json();
        const listEl = document.getElementById('exportsList');
        const zipBtnCont = document.getElementById('downloadZipContainer');
        const badge = document.getElementById('exportBadge');

        if (!data.items || data.items.length === 0) {
          listEl.innerHTML = \`
            <div class="empty-box">
              <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <div class="empty-title">Chưa có ảnh thành phẩm nào</div>
              <div class="empty-desc">Khi bạn bấm Xuất ảnh hoặc Xuất hàng loạt trên máy tính, ảnh sẽ lập tức xuất hiện tại đây để tải về điện thoại.</div>
            </div>\`;
          zipBtnCont.style.display = 'none';
          badge.style.display = 'none';
          return;
        }

        badge.innerText = data.items.length;
        badge.style.display = 'inline-block';
        zipBtnCont.style.display = 'block';

        listEl.innerHTML = data.items.map((it) => {
          const sizeKb = Math.round(it.fileSize / 1024);
          const sizeText = sizeKb > 1024 ? (sizeKb / 1024).toFixed(1) + ' MB' : sizeKb + ' KB';
          const viewUrl = '/api/view-file?id=' + encodeURIComponent(it.id);

          return \`
            <div class="export-item">
              <img
                src="\${viewUrl}"
                alt="\${it.fileName}"
                class="export-thumb"
                onclick="openLightbox('\${viewUrl}')"
              />
              <div class="export-info">
                <div class="export-name" title="\${it.fileName}">\${it.fileName}</div>
                <div class="export-meta">\${sizeText} • \${it.exportTime || ''}</div>
              </div>
              <div class="export-actions">
                <button type="button" class="btn-save-item" onclick="openLightbox('\${viewUrl}')">
                  📲 Lưu vào Ảnh
                </button>
                <button type="button" class="btn-preview-item" onclick="openLightbox('\${viewUrl}')">Xem chi tiết</button>
              </div>
            </div>\`;
        }).join('');
      } catch (err) {
        console.error('Failed to load exports:', err);
      }
    }

    // Lightbox handlers
    function openLightbox(url) {
      const box = document.getElementById('lightbox');
      const img = document.getElementById('lightboxImg');
      img.src = url;
      box.classList.add('active');
    }

    function closeLightbox() {
      const box = document.getElementById('lightbox');
      box.classList.remove('active');
    }

    // Poll exports count every 5 seconds if running
    setInterval(() => {
      fetch('/api/status')
        .then(r => r.json())
        .then(st => {
          if (st.exportCount > 0) {
            const badge = document.getElementById('exportBadge');
            badge.innerText = st.exportCount;
            badge.style.display = 'inline-block';
          }
        })
        .catch(() => {});
    }, 5000);
  </script>
</body>
</html>`;
  }
}
