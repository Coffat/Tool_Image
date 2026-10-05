import { contextBridge, ipcRenderer } from 'electron';
import { ImageItem, Preset, ProjectData } from '../shared/types';
import { ProcessImageParams } from './services/imageProcessor';
import { BatchItemProgress, BatchSummary } from './services/batchQueue';

const electronAPI = {
  openImages: (): Promise<ImageItem[]> => ipcRenderer.invoke('dialog:openImages'),
  openLogo: (): Promise<any> => ipcRenderer.invoke('dialog:openLogo'),
  selectOutputFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectOutputFolder'),
  getBrandLogos: (): Promise<any[]> => ipcRenderer.invoke('app:getBrandLogos'),
  getDroppedFileInfo: (filePaths: string[]): Promise<ImageItem[]> =>
    ipcRenderer.invoke('image:getDroppedFileInfo', filePaths),

  exportSingle: (params: ProcessImageParams): Promise<{
    outputPath: string;
    width: number;
    height: number;
    fileSize: number;
  }> => ipcRenderer.invoke('image:exportSingle', params),

  startBatch: (items: ProcessImageParams[]): Promise<BatchSummary> =>
    ipcRenderer.invoke('image:startBatch', items),

  cancelBatch: (): Promise<boolean> => ipcRenderer.invoke('image:cancelBatch'),

  onBatchProgress: (callback: (progress: BatchItemProgress) => void) => {
    const handler = (_event: any, data: BatchItemProgress) => callback(data);
    ipcRenderer.on('batch:progress', handler);
    return () => {
      ipcRenderer.removeListener('batch:progress', handler);
    };
  },

  getAllPresets: (): Promise<Preset[]> => ipcRenderer.invoke('preset:getAll'),
  savePreset: (preset: Preset): Promise<Preset[]> => ipcRenderer.invoke('preset:save', preset),
  deletePreset: (presetId: string): Promise<Preset[]> => ipcRenderer.invoke('preset:delete', presetId),

  saveProjectDialog: (data: ProjectData): Promise<string | null> =>
    ipcRenderer.invoke('project:saveDialog', data),
  loadProjectDialog: (): Promise<{ data: ProjectData; missingFiles: string[] } | null> =>
    ipcRenderer.invoke('project:loadDialog'),

  enhanceImage: (imagePath: string): Promise<{
    enhancedPath: string;
    originalWidth: number;
    originalHeight: number;
    newWidth: number;
    newHeight: number;
    fileSize: number;
  }> => ipcRenderer.invoke('image:enhance', imagePath),

  // iPhone Sync
  startIphoneSync: (): Promise<any> => ipcRenderer.invoke('iphone:start'),
  stopIphoneSync: (): Promise<boolean> => ipcRenderer.invoke('iphone:stop'),
  getIphoneSyncStatus: (): Promise<any> => ipcRenderer.invoke('iphone:getStatus'),
  openIphoneFolder: (): Promise<boolean> => ipcRenderer.invoke('iphone:openFolder'),
  onIphoneNewImages: (callback: (images: ImageItem[]) => void) => {
    const handler = (_event: any, data: ImageItem[]) => callback(data);
    ipcRenderer.on('iphone:newImages', handler);
    return () => {
      ipcRenderer.removeListener('iphone:newImages', handler);
    };
  },
  onIphoneStatusUpdate: (callback: (status: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('iphone:statusUpdate', handler);
    return () => {
      ipcRenderer.removeListener('iphone:statusUpdate', handler);
    };
  },

  // Smart Placement
  detectSmartPlacement: (imagePath: string): Promise<any> =>
    ipcRenderer.invoke('image:detectSmartPlacement', imagePath),
  detectBatchSmartPlacement: (imagePaths: string[]): Promise<any> =>
    ipcRenderer.invoke('image:detectBatchSmartPlacement', imagePaths),

  // Auto Updater
  checkForUpdates: (): Promise<any> => ipcRenderer.invoke('updater:check'),
  quitAndInstallUpdate: (): Promise<void> => ipcRenderer.invoke('updater:quitAndInstall'),
  onUpdaterStatus: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('updater:status', handler);
    return () => {
      ipcRenderer.removeListener('updater:status', handler);
    };
  },
  onUpdaterProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('updater:progress', handler);
    return () => {
      ipcRenderer.removeListener('updater:progress', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
console.log('[Phuong Nam Studio] Preload script loaded and electronAPI exposed successfully.');
