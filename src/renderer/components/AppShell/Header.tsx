import React from 'react';
import {
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  Download,
  Layers,
  FileSpreadsheet,
  Smartphone,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useBatchStore } from '../../stores/batchStore';
import { useExportPreviewStore } from '../../stores/exportPreviewStore';
import { ProjectData } from '../../../shared/types';
import { pickImages } from '../../utils/filePicker';

export const Header: React.FC = () => {
  const {
    images,
    activeImageId,
    logoTransform,
    exportOptions,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorStore();

  const openBatchModal = useBatchStore((state) => state.openModal);
  const openExportPreviewModal = useExportPreviewStore((state) => state.openModal);

  const handleOpenImages = async () => {
    await pickImages();
  };

  const handleSaveProject = async () => {
    if (!window.electronAPI?.saveProjectDialog) return;
    const projectData: ProjectData = {
      version: '1.0',
      createdDate: new Date().toISOString(),
      images: images.map((img) => ({ filePath: img.filePath })),
      activeLogoTransform: logoTransform,
      presets: [],
      exportOptions,
    };

    try {
      const savedPath = await window.electronAPI.saveProjectDialog(projectData);
      if (savedPath) {
        alert(`Đã lưu dự án tại: ${savedPath}`);
      }
    } catch (err: any) {
      alert(`Lỗi khi lưu dự án: ${err?.message}`);
    }
  };

  const handleLoadProject = async () => {
    if (!window.electronAPI?.loadProjectDialog) return;
    try {
      const result = await window.electronAPI.loadProjectDialog();
      if (!result) return;

      const { data, missingFiles } = result;
      if (missingFiles.length > 0) {
        alert(
          `Cảnh báo: Có ${missingFiles.length} file ảnh không tìm thấy:\n` +
            missingFiles.slice(0, 3).join('\n') +
            (missingFiles.length > 3 ? '\n...' : '')
        );
      }

      // Re-load valid images
      if (data.images && data.images.length > 0) {
        const validPaths = data.images
          .map((i) => i.filePath)
          .filter((p) => !missingFiles.includes(p));
        if (validPaths.length > 0) {
          const loadedImages = await window.electronAPI.getDroppedFileInfo(validPaths);
          useEditorStore.getState().setImages(loadedImages);
        }
      }

      if (data.activeLogoTransform) {
        useEditorStore.getState().updateLogoTransform(data.activeLogoTransform, true);
      }

      if (data.exportOptions) {
        useEditorStore.getState().setExportOptions(data.exportOptions);
      }
    } catch (err: any) {
      alert(`Lỗi khi mở dự án: ${err?.message}`);
    }
  };

  const handleExportSingle = () => {
    const editor = useEditorStore.getState();
    const activeImg = editor.images.find((i) => i.id === editor.activeImageId);
    if (!activeImg) {
      alert('Vui lòng chọn một ảnh sản phẩm để xem trước và xuất.');
      return;
    }

    const activeLogo =
      editor.brandLogos.find((l) => l.id === editor.activeLogoId) || editor.brandLogos[0];
    if (!activeLogo) {
      alert('Vui lòng chọn logo thương hiệu.');
      return;
    }

    openExportPreviewModal();
  };

  return (
    <header className="h-14 bg-brand-navy border-b border-brand-navy-dark text-white flex items-center justify-between px-4 select-none shrink-0 shadow-sm">
      {/* Brand & App Title */}
      <div className="flex items-center space-x-3">
        <img
          src="/assets/brand/phuong_nam_logo.png"
          alt="Phương Nam Logo"
          className="w-8 h-8 rounded-full border border-emerald-400 bg-white object-contain"
        />
        <div>
          <h1 className="text-sm font-bold tracking-wide text-white leading-tight">
            Phương Nam Product Studio
          </h1>
          <p className="text-[10px] text-emerald-300 font-medium tracking-wider uppercase">
            Thuốc Thú Y - Phương Nam
          </p>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handleOpenImages}
          title="Mở ảnh sản phẩm (Cmd/Ctrl + O)"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-brand-navy-light hover:bg-slate-700 text-xs font-medium transition"
        >
          <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
          <span>Mở ảnh</span>
        </button>

        <button
          onClick={() => useEditorStore.getState().setIphoneModalOpen(true)}
          title="Tải nhanh ảnh từ iPhone qua Wi-Fi nội bộ"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition"
        >
          <Smartphone className="w-3.5 h-3.5 text-white" />
          <span>Nhập từ iPhone</span>
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1" />

        <button
          onClick={handleLoadProject}
          title="Mở dự án đã lưu"
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded hover:bg-slate-800 text-xs text-slate-300 transition"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Mở Project</span>
        </button>

        <button
          onClick={handleSaveProject}
          title="Lưu file dự án (.phuongnamproject) (Cmd/Ctrl + S)"
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded hover:bg-slate-800 text-xs text-slate-300 transition"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Lưu Project</span>
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1" />

        <button
          onClick={undo}
          disabled={!canUndo()}
          title="Hoàn tác (Cmd/Ctrl + Z)"
          className={`p-1.5 rounded transition ${
            canUndo()
              ? 'hover:bg-slate-800 text-slate-200'
              : 'text-slate-600 cursor-not-allowed'
          }`}
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={redo}
          disabled={!canRedo()}
          title="Làm lại (Cmd/Ctrl + Shift + Z)"
          className={`p-1.5 rounded transition ${
            canRedo()
              ? 'hover:bg-slate-800 text-slate-200'
              : 'text-slate-600 cursor-not-allowed'
          }`}
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Export Buttons */}
      <div className="flex items-center space-x-2">
        <button
          onClick={openBatchModal}
          disabled={images.length === 0}
          title="Xử lý hàng loạt ảnh sản phẩm"
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${
            images.length > 0
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Xuất Hàng Loạt ({images.length})</span>
        </button>

        <button
          onClick={handleExportSingle}
          disabled={!activeImageId}
          title="Xuất ảnh đang chọn (Cmd/Ctrl + E)"
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition ${
            activeImageId
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Xuất Ảnh</span>
        </button>
      </div>
    </header>
  );
};
