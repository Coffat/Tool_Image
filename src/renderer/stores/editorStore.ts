import { create } from 'zustand';
import { ImageItem, LogoTransform, ExportOptions, NineAnchorPosition } from '../../shared/types';
import { DEFAULT_EXPORT_OPTIONS } from '../../shared/constants';
import { BrandLogoItem } from '../types/electron';
import { formatLocalImageUrl } from '../../shared/formatUrl';

interface EditorState {
  // Images
  images: ImageItem[];
  activeImageId: string | null;

  // Logos
  brandLogos: BrandLogoItem[];
  activeLogoId: string | null;

  // Transform (Normalized relative to image dimensions: 0.0 to 1.0)
  logoTransform: LogoTransform;

  // History for Undo/Redo
  history: LogoTransform[];
  historyIndex: number;

  // Viewport / Zoom
  zoom: number;

  // Export Settings
  exportOptions: ExportOptions;

  // Actions
  setImages: (images: ImageItem[]) => void;
  addImages: (images: ImageItem[]) => void;
  removeImage: (id: string) => void;
  setActiveImage: (id: string) => void;

  setBrandLogos: (logos: BrandLogoItem[]) => void;
  addBrandLogo: (logo: BrandLogoItem) => void;
  setActiveLogo: (id: string) => void;

  updateLogoTransform: (partial: Partial<LogoTransform>, recordHistory?: boolean) => void;
  setAnchorPosition: (pos: NineAnchorPosition, padding?: number) => void;
  resetLogoTransform: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  setZoom: (zoom: number) => void;
  setExportOptions: (options: Partial<ExportOptions>) => void;

  enhanceImageAction: (id: string) => Promise<void>;
  dismissEnhanceSuggestion: (id: string) => void;

  // Album filtering & iPhone Sync state
  albumFilter: 'all' | 'iphone';
  setAlbumFilter: (filter: 'all' | 'iphone') => void;
  isIphoneModalOpen: boolean;
  setIphoneModalOpen: (open: boolean) => void;
  iphoneStatus: any;
  setIphoneStatus: (status: any) => void;
  addIphoneImages: (newImages: ImageItem[]) => void;

  // Multi-Selection
  selectedImageIds: string[];
  lastSelectedId: string | null;
  toggleSelectImage: (id: string, isShift?: boolean) => void;
  selectAllImages: () => void;
  deselectAllImages: () => void;
  setSelectedImageIds: (ids: string[]) => void;
}

const DEFAULT_LOGO_TRANSFORM: LogoTransform = {
  logoId: 'brand-logo-default',
  logoPath: '',
  x: 0.82, // relative center X
  y: 0.82, // relative center Y
  width: 0.20, // 20% of image width
  height: 0.20, // 20% of image height
  rotation: 0,
  opacity: 0.95,
  flipX: false,
  flipY: false,
  keepAspectRatio: true,
};

export const useEditorStore = create<EditorState>((set, get) => ({
  images: [],
  activeImageId: null,

  brandLogos: [],
  activeLogoId: null,

  logoTransform: { ...DEFAULT_LOGO_TRANSFORM },
  history: [{ ...DEFAULT_LOGO_TRANSFORM }],
  historyIndex: 0,

  zoom: 1.0,
  exportOptions: { ...DEFAULT_EXPORT_OPTIONS },

  albumFilter: 'all',
  setAlbumFilter: (filter) => set({ albumFilter: filter }),
  isIphoneModalOpen: false,
  setIphoneModalOpen: (open) => set({ isIphoneModalOpen: open }),
  iphoneStatus: null,
  setIphoneStatus: (status) => set({ iphoneStatus: status }),
  addIphoneImages: (newImages) => {
    const { images } = get();
    const existingPaths = new Set(images.map((img) => img.filePath));
    const filtered = newImages.filter((img) => !existingPaths.has(img.filePath));
    const combined = [...images, ...filtered];
    set({
      images: combined,
      albumFilter: 'iphone',
    });
  },

  setImages: (images) => {
    set({
      images,
      activeImageId: images.length > 0 ? images[0].id : null,
      selectedImageIds: [],
    });
  },

  selectedImageIds: [],
  lastSelectedId: null,

  setSelectedImageIds: (ids) => set({ selectedImageIds: ids }),

  toggleSelectImage: (id, isShift = false) => {
    const { images, selectedImageIds, lastSelectedId } = get();

    if (isShift && lastSelectedId && lastSelectedId !== id) {
      const idx1 = images.findIndex((i) => i.id === lastSelectedId);
      const idx2 = images.findIndex((i) => i.id === id);
      if (idx1 !== -1 && idx2 !== -1) {
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        const rangeIds = images.slice(start, end + 1).map((i) => i.id);
        const union = Array.from(new Set([...selectedImageIds, ...rangeIds]));
        set({ selectedImageIds: union, lastSelectedId: id, activeImageId: id });
        return;
      }
    }

    const isAlreadySelected = selectedImageIds.includes(id);
    const updated = isAlreadySelected
      ? selectedImageIds.filter((item) => item !== id)
      : [...selectedImageIds, id];

    set({
      selectedImageIds: updated,
      lastSelectedId: id,
      activeImageId: id,
    });
  },

  selectAllImages: () => {
    const { images } = get();
    set({ selectedImageIds: images.map((i) => i.id) });
  },

  deselectAllImages: () => {
    set({ selectedImageIds: [] });
  },

  addImages: (newImages) => {
    const { images, activeImageId } = get();
    // Avoid duplicate paths
    const existingPaths = new Set(images.map((img) => img.filePath));
    const filtered = newImages.filter((img) => !existingPaths.has(img.filePath));
    const combined = [...images, ...filtered];
    set({
      images: combined,
      activeImageId: activeImageId || (combined.length > 0 ? combined[0].id : null),
    });
  },

  removeImage: (id) => {
    const { images, activeImageId } = get();
    const filtered = images.filter((img) => img.id !== id);
    let nextActive = activeImageId;
    if (activeImageId === id) {
      nextActive = filtered.length > 0 ? filtered[0].id : null;
    }
    set({ images: filtered, activeImageId: nextActive });
  },

  setActiveImage: (id) => set({ activeImageId: id }),

  setBrandLogos: (logos) => {
    const defaultLogo = logos.find((l) => l.isDefault) || logos[0];
    set((state) => ({
      brandLogos: logos,
      activeLogoId: defaultLogo ? defaultLogo.id : null,
      logoTransform: {
        ...state.logoTransform,
        logoId: defaultLogo ? defaultLogo.id : '',
        logoPath: defaultLogo ? defaultLogo.filePath : '',
      },
    }));
  },

  addBrandLogo: (logo) => {
    const { brandLogos } = get();
    const updated = [...brandLogos, logo];
    set({
      brandLogos: updated,
      activeLogoId: logo.id,
      logoTransform: {
        ...get().logoTransform,
        logoId: logo.id,
        logoPath: logo.filePath,
      },
    });
  },

  setActiveLogo: (id) => {
    const { brandLogos } = get();
    const found = brandLogos.find((l) => l.id === id);
    if (found) {
      get().updateLogoTransform(
        {
          logoId: found.id,
          logoPath: found.filePath,
        },
        true
      );
      set({ activeLogoId: id });
    }
  },

  updateLogoTransform: (partial, recordHistory = false) => {
    const { logoTransform, history, historyIndex } = get();
    const nextTransform = { ...logoTransform, ...partial };

    if (recordHistory) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({ ...nextTransform });
      // Limit history to 50 items
      if (newHistory.length > 50) newHistory.shift();

      set({
        logoTransform: nextTransform,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });
    } else {
      set({ logoTransform: nextTransform });
    }
  },

  setAnchorPosition: (pos, padding = 0.04) => {
    const { logoTransform, updateLogoTransform } = get();
    const w = logoTransform.width;
    const h = logoTransform.height;

    let cx = 0.5;
    let cy = 0.5;

    // X coordinates
    if (pos.includes('left')) {
      cx = padding + w / 2;
    } else if (pos.includes('right')) {
      cx = 1.0 - padding - w / 2;
    } else {
      cx = 0.5;
    }

    // Y coordinates
    if (pos.startsWith('top')) {
      cy = padding + h / 2;
    } else if (pos.startsWith('bottom')) {
      cy = 1.0 - padding - h / 2;
    } else {
      cy = 0.5;
    }

    updateLogoTransform({ x: cx, y: cy }, true);
  },

  resetLogoTransform: () => {
    const { brandLogos, activeLogoId } = get();
    const activeLogo = brandLogos.find((l) => l.id === activeLogoId) || brandLogos[0];
    const resetTransform: LogoTransform = {
      ...DEFAULT_LOGO_TRANSFORM,
      logoId: activeLogo ? activeLogo.id : '',
      logoPath: activeLogo ? activeLogo.filePath : '',
    };
    get().updateLogoTransform(resetTransform, true);
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      set({
        logoTransform: { ...history[nextIndex] },
        historyIndex: nextIndex,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      set({
        logoTransform: { ...history[nextIndex] },
        historyIndex: nextIndex,
      });
    }
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  setZoom: (zoom) => set({ zoom: Math.max(0.2, Math.min(3.0, zoom)) }),

  setExportOptions: (partial) => {
    set((state) => ({
      exportOptions: { ...state.exportOptions, ...partial },
    }));
  },

  enhanceImageAction: async (id: string) => {
    const { images } = get();
    const target = images.find((i) => i.id === id);
    if (!target) return;

    // Set processing status
    set({
      images: images.map((i) =>
        i.id === id ? { ...i, status: 'processing' } : i
      ),
    });

    try {
      if (window.electronAPI?.enhanceImage) {
        const result = await window.electronAPI.enhanceImage(target.filePath);
        set((state) => ({
          images: state.images.map((i) =>
            i.id === id
              ? {
                  ...i,
                  filePath: result.enhancedPath,
                  originalWidth: result.newWidth,
                  originalHeight: result.newHeight,
                  fileSize: result.fileSize,
                  previewUrl: `${formatLocalImageUrl(result.enhancedPath)}?t=${Date.now()}`,
                  status: 'idle',
                  suggestEnhance: false,
                  isEnhanced: true,
                }
              : i
          ),
        }));
      }
    } catch (err: any) {
      console.error('Enhance failed:', err);
      set((state) => ({
        images: state.images.map((i) =>
          i.id === id ? { ...i, status: 'error', errorMessage: err?.message } : i
        ),
      }));
    }
  },

  dismissEnhanceSuggestion: (id: string) => {
    set((state) => ({
      images: state.images.map((i) =>
        i.id === id ? { ...i, suggestEnhance: false } : i
      ),
    }));
  },
}));
