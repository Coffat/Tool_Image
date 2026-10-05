import React, { useEffect } from 'react';
import { Header } from './components/AppShell/Header';
import { Footer } from './components/AppShell/Footer';
import { ImagePanel } from './components/ImagePanel/ImagePanel';
import { CanvasEditor } from './components/Canvas/CanvasEditor';
import { LogoPanel } from './components/LogoPanel/LogoPanel';
import { BatchModal } from './components/BatchPanel/BatchModal';
import { BatchPreviewGalleryModal } from './components/BatchPanel/BatchPreviewGalleryModal';
import { ExportPreviewModal } from './components/ExportPreview/ExportPreviewModal';
import { IphoneSyncModal } from './components/IphoneSync/IphoneSyncModal';
import { UpdateNotification } from './components/AppShell/UpdateNotification';
import { useEditorStore } from './stores/editorStore';
import { usePresetStore } from './stores/presetStore';
import { useExportPreviewStore } from './stores/exportPreviewStore';

export const App: React.FC = () => {
  const {
    setBrandLogos,
    addImages,
    undo,
    redo,
    resetLogoTransform,
  } = useEditorStore();

  const loadPresets = usePresetStore((state) => state.loadPresets);

  // Initialize brand logos, presets, and sample product
  useEffect(() => {
    async function init() {
      if (window.electronAPI?.getBrandLogos) {
        try {
          const logos = await window.electronAPI.getBrandLogos();
          if (logos && logos.length > 0) {
            setBrandLogos(logos);
          }
        } catch (err) {
          console.error('Failed to load brand logos:', err);
        }
      }

      await loadPresets();

      // Load sample product image if available
      try {
        if (window.electronAPI?.getDroppedFileInfo) {
          const samplePaths = ['assets/brand/FLONOX-GOLD-PW.jpg'];
          const items = await window.electronAPI.getDroppedFileInfo(samplePaths);
          if (items.length > 0) {
            addImages(items);
          }
        }
      } catch (err) {
        // Ignore if sample doesn't exist
      }
    }

    init();

    // Listen to real-time iPhone uploads
    let unsubImages: (() => void) | undefined;
    let unsubStatus: (() => void) | undefined;

    if (window.electronAPI?.onIphoneNewImages) {
      unsubImages = window.electronAPI.onIphoneNewImages((newImgs) => {
        useEditorStore.getState().addIphoneImages(newImgs);
      });
    }

    if (window.electronAPI?.onIphoneStatusUpdate) {
      unsubStatus = window.electronAPI.onIphoneStatusUpdate((status) => {
        useEditorStore.getState().setIphoneStatus(status);
      });
    }

    return () => {
      unsubImages?.();
      unsubStatus?.();
    };
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + O -> Open Images
      if (cmdOrCtrl && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        window.electronAPI?.openImages?.().then((imgs) => {
          if (imgs && imgs.length > 0) addImages(imgs);
        });
      }

      // Cmd/Ctrl + Z -> Undo
      if (cmdOrCtrl && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
      }

      // Cmd/Ctrl + Shift + Z -> Redo
      if (cmdOrCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        redo();
      }

      // Cmd/Ctrl + E -> Open Export Preview
      if (cmdOrCtrl && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        const editor = useEditorStore.getState();
        const activeImg = editor.images.find((i) => i.id === editor.activeImageId);
        if (activeImg) {
          useExportPreviewStore.getState().openModal();
        }
      }

      // Delete / Backspace (when not in input)
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        resetLogoTransform();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
      {/* Top Navigation */}
      <Header />

      {/* Main Workspace (3 Column Layout) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Product Images */}
        <ImagePanel />

        {/* Center: Interactive Konva Canvas */}
        <CanvasEditor />

        {/* Right: Brand Logos, Positioning, Transform & Export */}
        <LogoPanel />
      </div>

      {/* Professional Running Footer */}
      <Footer />

      {/* Export Preview Modal */}
      <ExportPreviewModal />

      {/* Batch Processing Modal */}
      <BatchModal />

      {/* Batch Gallery Visual Preview Modal */}
      <BatchPreviewGalleryModal />

      {/* iPhone Direct Sync Modal */}
      <IphoneSyncModal />

      {/* Auto Update Notification Toast */}
      <UpdateNotification />
    </div>
  );
};
export default App;
