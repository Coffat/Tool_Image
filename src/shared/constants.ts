import { Preset, NineAnchorPosition, ExportOptions } from './types';

export const BRAND_COLORS = {
  primary: '#0F2C59',      // Deep Navy
  primaryHover: '#1B3C73',
  secondary: '#10B981',    // Emerald Green
  secondaryHover: '#059669',
  background: '#F8FAFC',
  panelBg: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  error: '#EF4444',
  success: '#10B981',
} as const;

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'jpeg',
  quality: 92,
  outputFolder: '',
  filenameSuffix: '-branded',
  overwriteMode: 'rename',
};

export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'preset-fb',
    name: 'Facebook Feed (Góc dưới phải)',
    relativeScale: 0.18,
    anchorPosition: 'bottom-right',
    paddingPercent: 0.03,
    opacity: 0.95,
    rotation: 0,
    flipX: false,
    flipY: false,
    exportOptions: {
      format: 'jpeg',
      quality: 92,
      outputFolder: '',
      filenameSuffix: '-phuongnam',
      overwriteMode: 'rename',
    },
  },
  {
    id: 'preset-zalo',
    name: 'Zalo / Báo giá (Chính giữa chống trộm)',
    relativeScale: 0.40,
    anchorPosition: 'center',
    paddingPercent: 0.0,
    opacity: 0.35,
    rotation: 0,
    flipX: false,
    flipY: false,
    exportOptions: {
      format: 'jpeg',
      quality: 90,
      outputFolder: '',
      filenameSuffix: '-watermark',
      overwriteMode: 'rename',
    },
  },
  {
    id: 'preset-ecommerce',
    name: 'Sàn TMĐT (Góc trên trái)',
    relativeScale: 0.15,
    anchorPosition: 'top-left',
    paddingPercent: 0.03,
    opacity: 1.0,
    rotation: 0,
    flipX: false,
    flipY: false,
    exportOptions: {
      format: 'jpeg',
      quality: 95,
      outputFolder: '',
      filenameSuffix: '-branded',
      overwriteMode: 'rename',
    },
  },
];

export const NINE_ANCHOR_POSITIONS: Array<{ id: NineAnchorPosition; label: string }> = [
  { id: 'top-left', label: 'Trên Trái' },
  { id: 'top-center', label: 'Trên Giữa' },
  { id: 'top-right', label: 'Trên Phải' },
  { id: 'center-left', label: 'Giữa Trái' },
  { id: 'center', label: 'Chính Giữa' },
  { id: 'center-right', label: 'Giữa Phải' },
  { id: 'bottom-left', label: 'Dưới Trái' },
  { id: 'bottom-center', label: 'Dưới Giữa' },
  { id: 'bottom-right', label: 'Dưới Phải' },
];
