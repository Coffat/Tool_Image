import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { app, BrowserWindow, shell } from 'electron';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { ImageProcessor } from './imageProcessor';
import { ImageEnhancer } from './imageEnhancer';
import { ImageItem, IphoneSyncStatus } from '../../shared/types';
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

  private getLocalIpAddress(): string {
    const interfaces = os.networkInterfaces();
    // Prioritize Wi-Fi and Ethernet interfaces
    const priorityNames = ['en0', 'en1', 'wlan0', 'eth0', 'wi-fi', 'wifi'];
    
    for (const name of priorityNames) {
      const ifaceList = interfaces[name];
      if (ifaceList) {
        for (const iface of ifaceList) {
          if (iface.family === 'IPv4' && !iface.internal) {
            return iface.address;
          }
        }
      }
    }

    // Fallback: any non-internal IPv4
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
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
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[IphoneServer] Port ${this.port} in use, trying next port...`);
          this.port += 1;
          this.server?.listen(this.port);
        } else {
          console.error('[IphoneServer] Server error:', err);
          reject(err);
        }
      });

      this.server.listen(this.port, async () => {
        this.isRunning = true;
        const url = `http://${this.ip}:${this.port}`;
        console.log(`[IphoneServer] Server running at ${url}`);

        try {
          this.qrCodeDataUrl = await QRCode.toDataURL(url, {
            width: 360,
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
    });
  }

  public async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server?.close(() => {
          this.isRunning = false;
          this.server = null;
          console.log('[IphoneServer] Server stopped.');
          resolve();
        });
      });
    }
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
      savedFolder: this.getSavedFolder(),
    };
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // CORS headers for local LAN
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

    if (req.method === 'POST' && parsedUrl.pathname === '/api/upload') {
      this.handleUpload(req, res, parsedUrl);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
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

          // Process with Sharp: rotate (EXIF orientation auto-fix) and convert HEIC to JPG
          if (isHeic) {
            await sharp(tempPath).rotate().jpeg({ quality: 95 }).toFile(finalFilePath);
            fs.unlinkSync(tempPath);
          } else {
            // Apply orientation auto-fix for camera shots
            try {
              await sharp(tempPath).rotate().toFile(finalFilePath);
              fs.unlinkSync(tempPath);
            } catch (sharpErr) {
              // If sharp cannot re-encode, fallback to direct rename
              fs.renameSync(tempPath, finalFilePath);
            }
          }

          const meta = await ImageProcessor.getMetadata(finalFilePath);
          this.receivedCount += 1;

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
  <title>Tải ảnh lên Phương Nam Studio</title>
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
      justify-content: center;
      padding: 20px;
      color: #FFFFFF;
    }
    .card {
      background: rgba(255, 255, 255, 0.96);
      color: #0F172A;
      width: 100%;
      max-width: 420px;
      border-radius: 28px;
      padding: 32px 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ECFDF5;
      color: #065F46;
      border: 1px solid #A7F3D0;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
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
      70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      color: #002B49;
      margin-bottom: 6px;
      line-height: 1.3;
    }
    .sub {
      font-size: 13px;
      color: #64748B;
      margin-bottom: 28px;
    }
    .btn-main {
      width: 100%;
      padding: 18px 24px;
      border-radius: 18px;
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: #FFFFFF;
      font-size: 17px;
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
      width: 24px;
      height: 24px;
    }
    .progress-box {
      display: none;
      margin-top: 24px;
      text-align: left;
    }
    .progress-bar-bg {
      width: 100%;
      height: 12px;
      background: #E2E8F0;
      border-radius: 999px;
      overflow: hidden;
      margin: 10px 0;
    }
    .progress-bar-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #10B981, #059669);
      border-radius: 999px;
      transition: width 0.25s ease;
    }
    .progress-text {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      display: flex;
      justify-content: space-between;
    }
    .success-box {
      display: none;
      margin-top: 24px;
      padding: 18px;
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      border-radius: 16px;
      color: #166534;
    }
    .success-box svg {
      width: 42px;
      height: 42px;
      margin-bottom: 8px;
      color: #16A34A;
    }
    .success-title {
      font-size: 16px;
      font-weight: 800;
    }
    .success-msg {
      font-size: 13px;
      color: #15803D;
      margin-top: 4px;
    }
    .btn-again {
      display: inline-block;
      margin-top: 14px;
      padding: 10px 20px;
      background: #16A34A;
      color: white;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
    }
    .tip {
      margin-top: 24px;
      font-size: 11px;
      color: #94A3B8;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <div class="pulse-dot"></div>
      ĐÃ KẾT NỐI VỚI MÁY TÍNH
    </div>

    <h1>Phương Nam Studio</h1>
    <p class="sub">Tải ảnh sản phẩm siêu tốc từ iPhone vào máy tính</p>

    <!-- Hidden native file input -->
    <input
      type="file"
      id="fileInput"
      multiple
      accept="image/*,image/heic,image/heif"
      style="display: none;"
    />

    <button id="uploadBtn" class="btn-main" onclick="document.getElementById('fileInput').click()">
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
      </svg>
      <span>Chụp hoặc Chọn ảnh gửi ngay</span>
    </button>

    <!-- Progress UI -->
    <div id="progressBox" class="progress-box">
      <div class="progress-text">
        <span id="progressLabel">Đang tải ảnh...</span>
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

    <p class="tip">
      ⚡ Ảnh gốc (kể cả HEIC) sẽ được tự động đồng bộ sang máy tính và hiển thị trong nhóm "iPhone Uploads".
    </p>
  </div>

  <script>
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const progressBox = document.getElementById('progressBox');
    const progressLabel = document.getElementById('progressLabel');
    const progressPercent = document.getElementById('progressPercent');
    const progressBarFill = document.getElementById('progressBarFill');
    const successBox = document.getElementById('successBox');
    const successCount = document.getElementById('successCount');

    fileInput.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      uploadBtn.style.display = 'none';
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

      // Done
      progressBox.style.display = 'none';
      successCount.innerText = 'Đã chuyển thành công ' + completed + ' ảnh sang máy tính!';
      successBox.style.display = 'block';

      if (navigator.vibrate) {
        navigator.vibrate([80, 50, 80]);
      }
    });

    function resetUI() {
      fileInput.value = '';
      uploadBtn.style.display = 'flex';
      progressBox.style.display = 'none';
      successBox.style.display = 'none';
      progressBarFill.style.width = '0%';
      fileInput.click();
    }
  </script>
</body>
</html>`;
  }
}
