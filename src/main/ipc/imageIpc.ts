import { dialog, BrowserWindow, ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { ImageProcessor, ProcessImageParams } from '../services/imageProcessor';
import { ImageEnhancer } from '../services/imageEnhancer';
import { BatchQueue } from '../services/batchQueue';
import { PresetService } from '../services/presetService';
import { ProjectService } from '../services/projectService';
import { IphoneServer } from '../services/iphoneServer';
import { SmartPlacementService } from '../services/smartPlacement';
import { ImageItem, Preset, ProjectData } from '../../shared/types';
import { formatLocalImageUrl } from '../../shared/formatUrl';

let activeBatchQueue: BatchQueue | null = null;

export function registerIpcHandlers(mainWindow: BrowserWindow) {
  // 1. Open Image Files dialog
  ipcMain.handle('dialog:openImages', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Chọn ảnh sản phẩm',
      buttonLabel: 'Chọn ảnh',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Ảnh (JPG, PNG, WebP)', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    const items: ImageItem[] = [];
    for (const filePath of result.filePaths) {
      try {
        const meta = await ImageProcessor.getMetadata(filePath);
        items.push({
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          filePath,
          fileName: path.basename(filePath),
          originalWidth: meta.width,
          originalHeight: meta.height,
          fileSize: meta.size,
          previewUrl: formatLocalImageUrl(filePath),
          status: 'idle',
          suggestEnhance: ImageEnhancer.shouldSuggestEnhance(meta.width, meta.height),
        });
      } catch (err: any) {
        console.error('Error reading image metadata:', filePath, err);
      }
    }
    return items;
  });

  // 2. Open Custom Logo file dialog
  ipcMain.handle('dialog:openLogo', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Chọn file Logo thương hiệu',
      buttonLabel: 'Chọn logo',
      properties: ['openFile'],
      filters: [
        { name: 'Ảnh logo (PNG, WebP, SVG, JPG)', extensions: ['png', 'webp', 'svg', 'jpg', 'jpeg'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const meta = await ImageProcessor.getMetadata(filePath);

    return {
      id: `logo-${Date.now()}`,
      name: path.basename(filePath),
      filePath,
      width: meta.width,
      height: meta.height,
      previewUrl: formatLocalImageUrl(filePath),
    };
  });

  // 3. Select Output Destination Folder
  ipcMain.handle('dialog:selectOutputFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Chọn thư mục lưu ảnh xuất',
      buttonLabel: 'Chọn thư mục',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // 4. Get Built-in Brand Logos
  ipcMain.handle('app:getBrandLogos', async () => {
    const isDev = !app.isPackaged;
    const baseDir = isDev ? process.cwd() : process.resourcesPath;

    const logoPath = path.join(baseDir, 'assets/brand/phuong_nam_logo.png');
    const brandLogos = [];

    if (fs.existsSync(logoPath)) {
      const meta = await ImageProcessor.getMetadata(logoPath);
      brandLogos.push({
        id: 'brand-logo-default',
        name: 'Logo Phương Nam',
        isDefault: true,
        filePath: logoPath,
        width: meta.width,
        height: meta.height,
        previewUrl: formatLocalImageUrl(logoPath),
      });
    }

    return brandLogos;
  });

  // 5. Single Image Export
  ipcMain.handle('image:exportSingle', async (_event, params: ProcessImageParams) => {
    const res = await ImageProcessor.processAndExport(params);
    if (res && res.outputPath) {
      IphoneServer.getInstance().registerExportedImages([res.outputPath]);
    }
    return res;
  });

  // 6. Batch Image Export
  ipcMain.handle('image:startBatch', async (_event, items: ProcessImageParams[]) => {
    activeBatchQueue = new BatchQueue();

    const summary = await activeBatchQueue.run(items, (progress) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('batch:progress', progress);
      }
    });

    if (summary && summary.results) {
      const successfulPaths = summary.results
        .filter((r) => r.status === 'success' && r.outputPath)
        .map((r) => r.outputPath as string);
      if (successfulPaths.length > 0) {
        IphoneServer.getInstance().registerExportedImages(successfulPaths);
      }
    }

    activeBatchQueue = null;
    return summary;
  });

  // 7. Cancel Batch Export
  ipcMain.handle('image:cancelBatch', async () => {
    if (activeBatchQueue) {
      activeBatchQueue.cancel();
      return true;
    }
    return false;
  });

  // 8. Preset Management
  ipcMain.handle('preset:getAll', async () => {
    return await PresetService.getAllPresets();
  });

  ipcMain.handle('preset:save', async (_event, preset: Preset) => {
    return await PresetService.savePreset(preset);
  });

  ipcMain.handle('preset:delete', async (_event, presetId: string) => {
    return await PresetService.deletePreset(presetId);
  });

  // 9. Project Save / Load
  ipcMain.handle('project:saveDialog', async (_event, data: ProjectData) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Lưu dự án Phương Nam',
      defaultPath: 'DuAn_PhuongNam.phuongnamproject',
      filters: [{ name: 'Phương Nam Project (*.phuongnamproject)', extensions: ['phuongnamproject'] }],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    await ProjectService.saveProject(result.filePath, data);
    return result.filePath;
  });

  ipcMain.handle('project:loadDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Mở file dự án',
      properties: ['openFile'],
      filters: [{ name: 'Phương Nam Project (*.phuongnamproject)', extensions: ['phuongnamproject'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    return await ProjectService.loadProject(filePath);
  });

  // 10. Load metadata for dragged/dropped files
  ipcMain.handle('image:getDroppedFileInfo', async (_event, filePaths: string[]) => {
    const items: ImageItem[] = [];
    for (const filePath of filePaths) {
      try {
        const ext = path.extname(filePath).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          continue;
        }
        const meta = await ImageProcessor.getMetadata(filePath);
        items.push({
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          filePath,
          fileName: path.basename(filePath),
          originalWidth: meta.width,
          originalHeight: meta.height,
          fileSize: meta.size,
          previewUrl: formatLocalImageUrl(filePath),
          status: 'idle',
          suggestEnhance: ImageEnhancer.shouldSuggestEnhance(meta.width, meta.height),
        });
      } catch (err) {
        console.error('Error reading dropped file:', filePath, err);
      }
    }
    return items;
  });

  // 11. AI Super Resolution & Enhancement
  ipcMain.handle('image:enhance', async (_event, imagePath: string) => {
    return await ImageEnhancer.enhanceImage(imagePath);
  });

  // 12. iPhone Sync Handlers
  ipcMain.handle('iphone:start', async () => {
    return await IphoneServer.getInstance().start(mainWindow);
  });

  ipcMain.handle('iphone:stop', async () => {
    await IphoneServer.getInstance().stop();
    return true;
  });

  ipcMain.handle('iphone:getStatus', async () => {
    return IphoneServer.getInstance().getStatus();
  });

  ipcMain.handle('iphone:openFolder', async () => {
    IphoneServer.getInstance().openSavedFolder();
    return true;
  });

  // 13. Smart Placement Handlers
  ipcMain.handle('image:detectSmartPlacement', async (_event, imagePath: string) => {
    return await SmartPlacementService.getInstance().detectPlacement(imagePath);
  });

  ipcMain.handle('image:detectBatchSmartPlacement', async (_event, imagePaths: string[]) => {
    return await SmartPlacementService.getInstance().detectBatch(imagePaths);
  });
}
