import { create } from 'zustand';
import { Preset, NineAnchorPosition } from '../../shared/types';
import { DEFAULT_PRESETS } from '../../shared/constants';
import { useEditorStore } from './editorStore';

interface PresetState {
  presets: Preset[];
  activePresetId: string | null;
  isLoading: boolean;

  loadPresets: () => Promise<void>;
  applyPreset: (presetId: string) => void;
  saveCurrentAsPreset: (name: string, anchorPosition?: NineAnchorPosition) => Promise<void>;
  deletePreset: (presetId: string) => Promise<void>;
}

export const usePresetStore = create<PresetState>((set, get) => ({
  presets: DEFAULT_PRESETS,
  activePresetId: null,
  isLoading: false,

  loadPresets: async () => {
    set({ isLoading: true });
    try {
      if (window.electronAPI?.getAllPresets) {
        const list = await window.electronAPI.getAllPresets();
        set({ presets: list });
      }
    } catch (err) {
      console.error('Failed to load presets:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  applyPreset: (presetId: string) => {
    const preset = get().presets.find((p) => p.id === presetId);
    if (!preset) return;

    const editorStore = useEditorStore.getState();

    // Compute relative dimensions based on preset
    const relW = preset.relativeScale;
    const relH = preset.relativeScale; // Default square scale

    editorStore.updateLogoTransform(
      {
        width: relW,
        height: relH,
        opacity: preset.opacity,
        rotation: preset.rotation,
        flipX: preset.flipX,
        flipY: preset.flipY,
      },
      false
    );

    // Apply anchor position
    editorStore.setAnchorPosition(preset.anchorPosition, preset.paddingPercent);

    if (preset.exportOptions) {
      editorStore.setExportOptions(preset.exportOptions);
    }

    set({ activePresetId: presetId });
  },

  saveCurrentAsPreset: async (name: string, anchorPosition: NineAnchorPosition = 'bottom-right') => {
    const editor = useEditorStore.getState();
    const newPreset: Preset = {
      id: `preset-${Date.now()}`,
      name,
      relativeScale: editor.logoTransform.width,
      anchorPosition,
      paddingPercent: 0.04,
      opacity: editor.logoTransform.opacity,
      rotation: editor.logoTransform.rotation,
      flipX: editor.logoTransform.flipX,
      flipY: editor.logoTransform.flipY,
      exportOptions: { ...editor.exportOptions },
    };

    if (window.electronAPI?.savePreset) {
      const updatedList = await window.electronAPI.savePreset(newPreset);
      set({ presets: updatedList, activePresetId: newPreset.id });
    } else {
      const updatedList = [...get().presets, newPreset];
      set({ presets: updatedList, activePresetId: newPreset.id });
    }
  },

  deletePreset: async (presetId: string) => {
    if (window.electronAPI?.deletePreset) {
      const updatedList = await window.electronAPI.deletePreset(presetId);
      set({
        presets: updatedList,
        activePresetId: get().activePresetId === presetId ? null : get().activePresetId,
      });
    } else {
      const updatedList = get().presets.filter((p) => p.id !== presetId);
      set({
        presets: updatedList,
        activePresetId: get().activePresetId === presetId ? null : get().activePresetId,
      });
    }
  },
}));
