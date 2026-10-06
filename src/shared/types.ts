// Shared data models for Phuong Nam Product Studio
export type ImageFormat = 'jpeg' | 'png' | 'webp';

export interface ImageItem {
  id: string;
  filePath: string;
  fileName: string;
  originalWidth: number;
  originalHeight: number;
  fileSize: number;
  previewUrl: string;
  status: 'idle' | 'processing' | 'success' | 'error';
  errorMessage?: string;
  outputPath?: string;
  suggestEnhance?: boolean;
  isEnhanced?: boolean;
  source?: 'local' | 'iphone';
  uploadTime?: string;
}

export interface IphoneSyncStatus {
  isRunning: boolean;
  ip: string;
  port: number;
  url: string;
  qrCodeDataUrl: string;
  receivedCount: number;
  exportCount?: number;
  savedFolder: string;
}

export interface ExportedMobileItem {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  exportTime: string;
}

export interface SmartPlacementResult {
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  cornerLabel: string;
  x: number;
  y: number;
  scale: number;
  opacity?: number;
  confidence: number;
  description: string;
}

export interface LogoTransform {
  logoId: string;
  logoPath: string;
  // Coordinates relative to preview or normalized (0..1)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // in degrees (0 - 360)
  opacity: number;  // 0 - 1
  flipX: boolean;
  flipY: boolean;
  keepAspectRatio: boolean;
}

export type NineAnchorPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ExportOptions {
  format: ImageFormat;
  quality: number; // 1 - 100
  outputFolder: string;
  filenameSuffix: string;
  overwriteMode: 'skip' | 'rename' | 'overwrite';
}

export interface Preset {
  id: string;
  name: string;
  relativeScale: number; // Percentage of image width (e.g. 0.20 = 20%)
  anchorPosition: NineAnchorPosition;
  paddingPercent: number; // Percentage of image dimensions (e.g. 0.03 = 3%)
  opacity: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  exportOptions: ExportOptions;
}

export interface ProjectData {
  version: '1.0';
  createdDate: string;
  images: Array<{ filePath: string }>;
  activeLogoTransform: LogoTransform;
  presets: Preset[];
  exportOptions: ExportOptions;
}
