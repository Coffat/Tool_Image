import { ImageItem, Preset, ProjectData } from '../../shared/types';
import { ProcessImageParams } from '../../main/services/imageProcessor';
import { BatchItemProgress, BatchSummary } from '../../main/services/batchQueue';

export interface BrandLogoItem {
  id: string;
  name: string;
  isDefault: boolean;
  filePath: string;
  width: number;
  height: number;
  previewUrl: string;
}

export interface ElectronAPI {
  openImages: () => Promise<ImageItem[]>;
  openLogo: () => Promise<BrandLogoItem | null>;
  selectOutputFolder: () => Promise<string | null>;
  getBrandLogos: () => Promise<BrandLogoItem[]>;
  getDroppedFileInfo: (filePaths: string[]) => Promise<ImageItem[]>;

  exportSingle: (params: ProcessImageParams) => Promise<{
    outputPath: string;
    width: number;
    height: number;
    fileSize: number;
  }>;

  startBatch: (items: ProcessImageParams[]) => Promise<BatchSummary>;
  cancelBatch: () => Promise<boolean>;
  onBatchProgress: (callback: (progress: BatchItemProgress) => void) => () => void;

  getAllPresets: () => Promise<Preset[]>;
  savePreset: (preset: Preset) => Promise<Preset[]>;
  deletePreset: (presetId: string) => Promise<Preset[]>;

  saveProjectDialog: (data: ProjectData) => Promise<string | null>;
  loadProjectDialog: () => Promise<{ data: ProjectData; missingFiles: string[] } | null>;

  enhanceImage: (imagePath: string) => Promise<{
    enhancedPath: string;
    originalWidth: number;
    originalHeight: number;
    newWidth: number;
    newHeight: number;
    fileSize: number;
  }>;

  startIphoneSync: () => Promise<import('../../shared/types').IphoneSyncStatus>;
  stopIphoneSync: () => Promise<boolean>;
  getIphoneSyncStatus: () => Promise<import('../../shared/types').IphoneSyncStatus>;
  openIphoneFolder: () => Promise<boolean>;
  onIphoneNewImages: (callback: (images: import('../../shared/types').ImageItem[]) => void) => () => void;
  onIphoneStatusUpdate: (callback: (status: import('../../shared/types').IphoneSyncStatus) => void) => () => void;

  detectSmartPlacement: (imagePath: string) => Promise<import('../../shared/types').SmartPlacementResult>;
  detectBatchSmartPlacement: (imagePaths: string[]) => Promise<Record<string, import('../../shared/types').SmartPlacementResult>>;

  checkForUpdates: () => Promise<any>;
  quitAndInstallUpdate: () => Promise<void>;
  onUpdaterStatus: (callback: (data: any) => void) => () => void;
  onUpdaterProgress: (callback: (data: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}
