import { ImageItem } from '../../shared/types';
import { useEditorStore } from '../stores/editorStore';

/**
 * Universal file picker that uses native Electron dialog if available,
 * and gracefully falls back to browser file input if opened in browser.
 */
export async function pickImages(): Promise<void> {
  const { addImages } = useEditorStore.getState();

  // 1. Electron environment
  if (window.electronAPI?.openImages) {
    try {
      const selected = await window.electronAPI.openImages();
      if (selected && selected.length > 0) {
        addImages(selected);
        return;
      }
      // User canceled dialog
      if (selected && selected.length === 0) return;
    } catch (err) {
      console.error('Electron openImages failed, trying browser fallback:', err);
    }
  }

  // 2. Web browser fallback
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/jpeg,image/png,image/webp';

  input.onchange = async () => {
    if (!input.files || input.files.length === 0) return;

    const items: ImageItem[] = [];

    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const previewUrl = URL.createObjectURL(file);

      // Measure dimensions
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = previewUrl;
      });

      items.push({
        id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        filePath: (file as any).path || file.name,
        fileName: file.name,
        originalWidth: img.naturalWidth || 1200,
        originalHeight: img.naturalHeight || 1200,
        fileSize: file.size,
        previewUrl,
        status: 'idle',
      });
    }

    if (items.length > 0) {
      addImages(items);
    }
  };

  input.click();
}

export async function pickCustomLogo(): Promise<void> {
  const { addBrandLogo } = useEditorStore.getState();

  // 1. Electron environment
  if (window.electronAPI?.openLogo) {
    try {
      const logo = await window.electronAPI.openLogo();
      if (logo) {
        addBrandLogo(logo);
        return;
      }
      if (logo === null) return;
    } catch (err) {
      console.error('Electron openLogo failed, trying browser fallback:', err);
    }
  }

  // 2. Web browser fallback
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/webp,image/svg+xml,image/jpeg';

  input.onchange = async () => {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const previewUrl = URL.createObjectURL(file);

    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = previewUrl;
    });

    addBrandLogo({
      id: `logo-${Date.now()}`,
      name: file.name,
      isDefault: false,
      filePath: (file as any).path || file.name,
      width: img.naturalWidth || 500,
      height: img.naturalHeight || 500,
      previewUrl,
    });
  };

  input.click();
}
