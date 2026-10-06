import { create } from 'zustand';
import { BatchItemProgress, BatchSummary } from '../../main/services/batchQueue';
import { ProcessImageParams } from '../../main/services/imageProcessor';
import { SmartPlacementResult } from '../../shared/types';
import { useEditorStore } from './editorStore';

function computeCornerCoordinates(
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  scale: number
): { x: number; y: number } {
  const padding = 0.035;
  let x = 0.5;
  let y = 0.5;
  switch (corner) {
    case 'top-left':
      x = padding + scale / 2;
      y = padding + scale / 2;
      break;
    case 'top-right':
      x = 1.0 - padding - scale / 2;
      y = padding + scale / 2;
      break;
    case 'bottom-left':
      x = padding + scale / 2;
      y = 1.0 - padding - scale / 2;
      break;
    case 'bottom-right':
    default:
      x = 1.0 - padding - scale / 2;
      y = 1.0 - padding - scale / 2;
      break;
  }
  return {
    x: Math.round(x * 1000) / 1000,
    y: Math.round(y * 1000) / 1000,
  };
}

interface BatchState {
  isOpen: boolean;
  isProcessing: boolean;
  isGalleryPreviewOpen: boolean;
  autoEnhanceLowRes: boolean;
  smartPlacementEnabled: boolean;
  smartPlacements: Record<string, SmartPlacementResult>;
  isAnalyzingSmartPlacements: boolean;
  globalScale: number;
  globalOpacity: number;
  progress: BatchItemProgress | null;
  summary: BatchSummary | null;

  setAutoEnhanceLowRes: (val: boolean) => void;
  setSmartPlacementEnabled: (val: boolean) => void;
  analyzeSmartPlacements: () => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  openGalleryPreview: () => void;
  closeGalleryPreview: () => void;
  updateItemCorner: (
    filePath: string,
    corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  ) => void;
  updateItemScale: (filePath: string, scale: number) => void;
  updateItemOpacity: (filePath: string, opacity: number) => void;
  setGlobalScale: (scale: number) => void;
  setGlobalOpacity: (opacity: number) => void;
  removeItemFromGallery: (id: string) => void;
  startBatchExport: (onlySelected?: boolean) => Promise<void>;
  cancelBatchExport: () => Promise<void>;
}

export const useBatchStore = create<BatchState>((set, get) => ({
  isOpen: false,
  isProcessing: false,
  isGalleryPreviewOpen: false,
  autoEnhanceLowRes: true,
  smartPlacementEnabled: true,
  smartPlacements: {},
  isAnalyzingSmartPlacements: false,
  globalScale: 0.20,
  globalOpacity: 1.0,
  progress: null,
  summary: null,

  setAutoEnhanceLowRes: (val) => set({ autoEnhanceLowRes: val }),

  setSmartPlacementEnabled: (val) => {
    set({ smartPlacementEnabled: val });
    if (val && Object.keys(get().smartPlacements).length === 0) {
      get().analyzeSmartPlacements();
    }
  },

  analyzeSmartPlacements: async () => {
    const editor = useEditorStore.getState();
    const { images, selectedImageIds, logoTransform } = editor;
    const targetImages =
      selectedImageIds.length > 0
        ? images.filter((img) => selectedImageIds.includes(img.id))
        : images;

    if (targetImages.length === 0) return;

    if (window.electronAPI?.detectBatchSmartPlacement) {
      set({ isAnalyzingSmartPlacements: true });
      try {
        const filePaths = targetImages.map((i) => i.filePath);
        const results = await window.electronAPI.detectBatchSmartPlacement(filePaths);
        // Ensure default opacity from logoTransform if not present
        const defaultOp = logoTransform?.opacity ?? get().globalOpacity ?? 1.0;
        const normalizedResults: Record<string, SmartPlacementResult> = {};
        for (const [key, res] of Object.entries(results)) {
          normalizedResults[key] = {
            ...res,
            opacity: res.opacity !== undefined ? res.opacity : defaultOp,
          };
        }
        set((state) => ({
          smartPlacements: { ...state.smartPlacements, ...normalizedResults },
          isAnalyzingSmartPlacements: false,
        }));
      } catch (err) {
        console.error('Failed to analyze batch smart placement:', err);
        set({ isAnalyzingSmartPlacements: false });
      }
    }
  },

  openModal: () => {
    set({ isOpen: true, summary: null });
    if (get().smartPlacementEnabled) {
      get().analyzeSmartPlacements();
    }
  },

  closeModal: () => {
    if (!get().isProcessing) {
      set({ isOpen: false });
    }
  },

  openGalleryPreview: () => {
    const editor = useEditorStore.getState();
    const initialOp = editor.logoTransform?.opacity ?? 1.0;
    const initialScale = editor.logoTransform?.width || 0.20;
    set({
      isGalleryPreviewOpen: true,
      globalOpacity: initialOp,
      globalScale: initialScale,
    });
    get().analyzeSmartPlacements();
  },

  closeGalleryPreview: () => {
    set({ isGalleryPreviewOpen: false });
  },

  updateItemCorner: (filePath, corner) => {
    const current = get().smartPlacements[filePath] || {
      corner: 'top-right',
      cornerLabel: 'Góc trên - phải',
      x: 0.85,
      y: 0.15,
      scale: get().globalScale || 0.20,
      opacity: get().globalOpacity ?? 1.0,
      confidence: 1.0,
      description: 'Đã tùy chỉnh thủ công',
    };

    const scale = current.scale || 0.20;
    const { x, y } = computeCornerCoordinates(corner, scale);
    const cornerLabels = {
      'top-left': 'Góc trên - trái',
      'top-right': 'Góc trên - phải',
      'bottom-left': 'Góc dưới - trái',
      'bottom-right': 'Góc dưới - phải',
    };
    const cornerLabel = cornerLabels[corner] || 'Góc trên - phải';

    set((state) => ({
      smartPlacements: {
        ...state.smartPlacements,
        [filePath]: {
          ...current,
          corner,
          cornerLabel,
          x,
          y,
          description: `Đã đổi sang ${cornerLabel}`,
        },
      },
    }));
  },

  updateItemScale: (filePath, scale) => {
    const current = get().smartPlacements[filePath] || {
      corner: 'top-right',
      cornerLabel: 'Góc trên - phải',
      x: 0.85,
      y: 0.15,
      scale: 0.20,
      opacity: get().globalOpacity ?? 1.0,
      confidence: 1.0,
      description: 'Đã tùy chỉnh thủ công',
    };
    const clampedScale = Math.max(0.05, Math.min(0.8, Math.round(scale * 100) / 100));
    const { x, y } = computeCornerCoordinates(current.corner, clampedScale);

    set((state) => ({
      smartPlacements: {
        ...state.smartPlacements,
        [filePath]: {
          ...current,
          scale: clampedScale,
          x,
          y,
        },
      },
    }));
  },

  updateItemOpacity: (filePath, opacity) => {
    const current = get().smartPlacements[filePath] || {
      corner: 'top-right',
      cornerLabel: 'Góc trên - phải',
      x: 0.85,
      y: 0.15,
      scale: get().globalScale || 0.20,
      opacity: 1.0,
      confidence: 1.0,
      description: 'Đã tùy chỉnh thủ công',
    };
    const clampedOpacity = Math.max(0.05, Math.min(1.0, Math.round(opacity * 100) / 100));

    set((state) => ({
      smartPlacements: {
        ...state.smartPlacements,
        [filePath]: {
          ...current,
          opacity: clampedOpacity,
        },
      },
    }));
  },

  setGlobalScale: (scale) => {
    const clampedScale = Math.max(0.05, Math.min(0.8, Math.round(scale * 100) / 100));
    const currentPlacements = { ...get().smartPlacements };
    const editor = useEditorStore.getState();
    const targetImages = editor.images;

    for (const img of targetImages) {
      const cur = currentPlacements[img.filePath] || {
        corner: 'top-right',
        cornerLabel: 'Góc trên - phải',
        x: 0.85,
        y: 0.15,
        scale: 0.20,
        opacity: get().globalOpacity ?? 1.0,
        confidence: 1.0,
        description: 'Vị trí mặc định',
      };
      const { x, y } = computeCornerCoordinates(cur.corner, clampedScale);
      currentPlacements[img.filePath] = {
        ...cur,
        scale: clampedScale,
        x,
        y,
      };
    }

    set({
      globalScale: clampedScale,
      smartPlacements: currentPlacements,
    });
  },

  setGlobalOpacity: (opacity) => {
    const clampedOpacity = Math.max(0.05, Math.min(1.0, Math.round(opacity * 100) / 100));
    const currentPlacements = { ...get().smartPlacements };
    const editor = useEditorStore.getState();
    const targetImages = editor.images;

    for (const img of targetImages) {
      const cur = currentPlacements[img.filePath] || {
        corner: 'top-right',
        cornerLabel: 'Góc trên - phải',
        x: 0.85,
        y: 0.15,
        scale: get().globalScale || 0.20,
        opacity: 1.0,
        confidence: 1.0,
        description: 'Vị trí mặc định',
      };
      currentPlacements[img.filePath] = {
        ...cur,
        opacity: clampedOpacity,
      };
    }

    set({
      globalOpacity: clampedOpacity,
      smartPlacements: currentPlacements,
    });
  },

  removeItemFromGallery: (id) => {
    const editor = useEditorStore.getState();
    const updated = editor.selectedImageIds.filter((item) => item !== id);
    editor.setSelectedImageIds(updated);
  },

  startBatchExport: async (onlySelected = false) => {
    const editor = useEditorStore.getState();
    const { images, selectedImageIds, logoTransform, exportOptions, brandLogos, activeLogoId } =
      editor;

    let targetImages = images;
    if (onlySelected || (selectedImageIds.length > 0 && get().isGalleryPreviewOpen)) {
      targetImages = images.filter((img) => selectedImageIds.includes(img.id));
    }

    if (targetImages.length === 0) {
      alert('Chưa có ảnh sản phẩm nào để xuất hàng loạt.');
      return;
    }

    const activeLogo = brandLogos.find((l) => l.id === activeLogoId) || brandLogos[0];
    if (!activeLogo || !activeLogo.filePath) {
      alert('Không tìm thấy logo hợp lệ để gắn lên ảnh.');
      return;
    }

    // Close preview gallery and open main batch progress modal
    set({ isGalleryPreviewOpen: false, isOpen: true, isProcessing: true });

    // Auto-enhance low resolution images if option enabled
    let exportImages = targetImages;
    if (get().autoEnhanceLowRes && typeof window.electronAPI?.enhanceImage === 'function') {
      for (const img of targetImages) {
        if (img.suggestEnhance && !img.isEnhanced) {
          try {
            await editor.enhanceImageAction(img.id);
          } catch (e) {
            console.warn('Auto enhance failed for', img.fileName, e);
          }
        }
      }
      exportImages = useEditorStore
        .getState()
        .images.filter((img) => targetImages.some((t) => t.id === img.id));
    }

    const { smartPlacementEnabled, smartPlacements } = get();

    const items: ProcessImageParams[] = exportImages.map((img) => {
      const smart = smartPlacementEnabled ? smartPlacements[img.filePath] : null;

      return {
        imagePath: img.filePath,
        logoPath: activeLogo.filePath,
        transform: {
          relCenterX: smart ? smart.x : logoTransform.x,
          relCenterY: smart ? smart.y : logoTransform.y,
          relWidth: smart ? smart.scale : logoTransform.width,
          relHeight: smart ? smart.scale : logoTransform.height,
          rotation: logoTransform.rotation,
          opacity: smart?.opacity !== undefined ? smart.opacity : logoTransform.opacity,
          flipX: logoTransform.flipX,
          flipY: logoTransform.flipY,
        },
        exportOptions: { ...exportOptions },
      };
    });

    set({
      progress: {
        index: 0,
        total: items.length,
        currentFilePath: items[0].imagePath,
        status: 'processing',
      },
      summary: null,
    });

    const unsubscribe = window.electronAPI.onBatchProgress((p) => {
      set({ progress: p });
    });

    try {
      const summary = await window.electronAPI.startBatch(items);
      set({
        summary,
        isProcessing: false,
      });
    } catch (err: any) {
      console.error('Batch export failed:', err);
      set({
        isProcessing: false,
      });
    } finally {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }
  },

  cancelBatchExport: async () => {
    if (window.electronAPI?.cancelBatch) {
      await window.electronAPI.cancelBatch();
    }
  },
}));
