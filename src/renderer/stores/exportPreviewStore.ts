import { create } from "zustand";

interface ExportPreviewState {
  isOpen: boolean;
  applyAiEnhance: boolean;
  compareSliderPos: number; // 0 to 100%
  compareMode: "split" | "toggle";
  toggleView: "before" | "after";
  isGeneratingEnhancedPreview: boolean;
  enhancedPreviewUrl: string | null;
  enhancedWidth: number | null;
  enhancedHeight: number | null;
  enhancedFilePath: string | null;
  isExporting: boolean;

  openModal: () => void;
  closeModal: () => void;
  setApplyAiEnhance: (val: boolean) => void;
  setCompareSliderPos: (pos: number) => void;
  setCompareMode: (mode: "split" | "toggle") => void;
  setToggleView: (view: "before" | "after") => void;
  setEnhancedData: (url: string | null, width?: number, height?: number, filePath?: string | null) => void;
  setIsGeneratingEnhancedPreview: (val: boolean) => void;
  setIsExporting: (val: boolean) => void;
  reset: () => void;
}

export const useExportPreviewStore = create<ExportPreviewState>((set) => ({
  isOpen: false,
  applyAiEnhance: false,
  compareSliderPos: 50,
  compareMode: "split",
  toggleView: "after",
  isGeneratingEnhancedPreview: false,
  enhancedPreviewUrl: null,
  enhancedWidth: null,
  enhancedHeight: null,
  enhancedFilePath: null,
  isExporting: false,

  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false }),
  setApplyAiEnhance: (val) => set({ applyAiEnhance: val }),
  setCompareSliderPos: (pos) => set({ compareSliderPos: Math.max(0, Math.min(100, pos)) }),
  setCompareMode: (mode) => set({ compareMode: mode }),
  setToggleView: (view) => set({ toggleView: view }),
  setEnhancedData: (url, width, height, filePath) =>
    set({
      enhancedPreviewUrl: url,
      enhancedWidth: width ?? null,
      enhancedHeight: height ?? null,
      enhancedFilePath: filePath ?? null,
    }),
  setIsGeneratingEnhancedPreview: (val) => set({ isGeneratingEnhancedPreview: val }),
  setIsExporting: (val) => set({ isExporting: val }),
  reset: () =>
    set({
      isOpen: false,
      applyAiEnhance: false,
      compareSliderPos: 50,
      compareMode: "split",
      toggleView: "after",
      isGeneratingEnhancedPreview: false,
      enhancedPreviewUrl: null,
      enhancedWidth: null,
      enhancedHeight: null,
      enhancedFilePath: null,
      isExporting: false,
    }),
}));
