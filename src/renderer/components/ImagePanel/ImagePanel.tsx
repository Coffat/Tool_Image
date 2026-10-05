import React, { useState } from 'react';
import {
  Plus,
  UploadCloud,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Smartphone,
  QrCode,
  Layers,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useBatchStore } from '../../stores/batchStore';
import { ImageItem } from '../../../shared/types';
import { pickImages } from '../../utils/filePicker';

export const ImagePanel: React.FC = () => {
  const {
    images,
    activeImageId,
    addImages,
    removeImage,
    setActiveImage,
    enhanceImageAction,
    albumFilter,
    setAlbumFilter,
    setIphoneModalOpen,
    selectedImageIds,
    toggleSelectImage,
    selectAllImages,
    deselectAllImages,
  } = useEditorStore();

  const openGalleryPreview = useBatchStore((state) => state.openGalleryPreview);

  const [isDragOver, setIsDragOver] = useState(false);

  const handleOpenFileDialog = async () => {
    await pickImages();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filePaths: string[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const p = (file as any).path;
        if (p) {
          filePaths.push(p);
        }
      }

      if (filePaths.length > 0 && window.electronAPI?.getDroppedFileInfo) {
        const items = await window.electronAPI.getDroppedFileInfo(filePaths);
        if (items.length > 0) {
          addImages(items);
        }
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const iphoneImages = images.filter((img) => img.source === 'iphone');
  const displayedImages = albumFilter === 'iphone' ? iphoneImages : images;

  const isAllSelected =
    displayedImages.length > 0 &&
    displayedImages.every((img) => selectedImageIds.includes(img.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      deselectAllImages();
    } else if (albumFilter === 'all') {
      selectAllImages();
    } else {
      useEditorStore.getState().setSelectedImageIds(displayedImages.map((i) => i.id));
    }
  };

  const handleItemClick = (e: React.MouseEvent, imgId: string) => {
    if (e.shiftKey) {
      toggleSelectImage(imgId, true);
    } else if (e.metaKey || e.ctrlKey) {
      toggleSelectImage(imgId, false);
    } else {
      setActiveImage(imgId);
    }
  };

  return (
    <aside
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 select-none transition-colors ${
        isDragOver ? 'bg-emerald-50/60 ring-2 ring-emerald-400 ring-inset' : ''
      }`}
    >
      {/* Panel Header */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Ảnh Sản Phẩm
          </h2>
          <span className="text-[11px] text-slate-500 font-medium">
            {images.length} ảnh đã nạp
          </span>
        </div>
        <button
          onClick={handleOpenFileDialog}
          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-brand-navy hover:bg-slate-800 text-white text-xs font-medium shadow-sm transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm ảnh</span>
        </button>
      </div>

      {/* Album Tabs (All vs iPhone Uploads) */}
      <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 gap-1">
        <button
          onClick={() => setAlbumFilter('all')}
          className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
            albumFilter === 'all'
              ? 'bg-white text-slate-800 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>Tất cả</span>
          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
            {images.length}
          </span>
        </button>

        <button
          onClick={() => setAlbumFilter('iphone')}
          className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
            albumFilter === 'iphone'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>iPhone</span>
          {iphoneImages.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                albumFilter === 'iphone'
                  ? 'bg-emerald-800 text-emerald-100'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {iphoneImages.length}
            </span>
          )}
        </button>
      </div>

      {/* Multi-Selection Control Bar */}
      {displayedImages.length > 0 && (
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <button
            onClick={handleToggleSelectAll}
            className="flex items-center space-x-1.5 text-slate-700 hover:text-emerald-700 font-semibold cursor-pointer"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>{isAllSelected ? 'Bỏ chọn' : 'Chọn tất cả'}</span>
          </button>

          <span className="text-[11px] font-medium text-slate-500">
            Đã chọn{' '}
            <strong className="text-emerald-700 font-bold">
              {selectedImageIds.filter((id) => displayedImages.some((d) => d.id === id)).length}
            </strong>
            /{displayedImages.length}
          </span>
        </div>
      )}

      {/* Quick Action: Nhập từ iPhone Banner */}
      <div className="p-3 pb-1">
        <button
          onClick={() => setIphoneModalOpen(true)}
          className="w-full p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200 hover:border-emerald-400 hover:shadow-xs flex items-center justify-between text-left transition group cursor-pointer"
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-2xs group-hover:scale-105 transition">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                <span>Nhập từ iPhone</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </p>
              <p className="text-[10px] text-emerald-700 font-medium">Quét mã QR qua Wi-Fi</p>
            </div>
          </div>
          <div className="p-1 rounded-md bg-white border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white text-emerald-700 transition">
            <QrCode className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* Drag & Drop Quick Area */}
      <div
        onClick={handleOpenFileDialog}
        className="mx-3 my-2 p-2.5 border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-lg bg-slate-50 hover:bg-emerald-50/40 text-center cursor-pointer transition"
      >
        <UploadCloud className="w-5 h-5 mx-auto text-slate-400 mb-0.5" />
        <p className="text-xs font-medium text-slate-700">Kéo thả ảnh hoặc bấm thêm</p>
        <p className="text-[10px] text-slate-400">Hỗ trợ JPG, PNG, WebP, HEIC</p>
      </div>

      {/* Image Thumbnail List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {displayedImages.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-center p-4">
            {albumFilter === 'iphone' ? (
              <>
                <Smartphone className="w-8 h-8 mb-2 stroke-[1.5] text-emerald-400" />
                <p className="text-xs font-medium text-slate-600">Chưa có ảnh nào từ iPhone</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Bấm "Nhập từ iPhone" ở trên để quét mã QR và tải ảnh vào đây
                </p>
              </>
            ) : (
              <>
                <ImageIcon className="w-8 h-8 mb-2 stroke-[1.5] text-slate-300" />
                <p className="text-xs font-medium text-slate-500">Chưa có ảnh nào</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Nhấn "+ Thêm ảnh" hoặc kéo thả ảnh từ máy tính vào đây
                </p>
              </>
            )}
          </div>
        ) : (
          displayedImages.map((img: ImageItem, idx: number) => {
            const isActive = img.id === activeImageId;
            const isSelected = selectedImageIds.includes(img.id);

            return (
              <div
                key={img.id}
                onClick={(e) => handleItemClick(e, img.id)}
                className={`group relative flex items-center p-2 rounded-lg border text-left cursor-pointer transition ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500'
                    : isActive
                    ? 'border-brand-navy bg-slate-100 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                }`}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectImage(img.id, e.shiftKey);
                  }}
                  className="mr-2 text-slate-400 hover:text-emerald-600 transition"
                  title="Chọn ảnh này"
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                  )}
                </button>

                {/* Thumbnail with clean badge */}
                <div className="relative w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  <span className="absolute top-0.5 left-0.5 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-1 py-0.2 rounded z-10 shadow-xs">
                    #{idx + 1}
                  </span>
                  <img
                    src={img.previewUrl}
                    alt={img.fileName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Info */}
                <div className="ml-2.5 flex-1 min-w-0 pr-6">
                  <div className="flex items-center space-x-1">
                    <p className="text-xs font-semibold text-slate-800 truncate" title={img.fileName}>
                      {img.fileName}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 mt-0.5">
                    {img.source === 'iphone' && (
                      <span className="inline-flex items-center text-[9px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.2 rounded">
                        📱 iPhone
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono">
                      {img.originalWidth} × {img.originalHeight}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatBytes(img.fileSize)}
                  </p>

                  {img.isEnhanced && (
                    <div className="inline-flex items-center space-x-1 text-[9px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mt-1">
                      <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                      <span>Đã nét 2X</span>
                    </div>
                  )}

                  {img.suggestEnhance && !img.isEnhanced && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        enhanceImageAction(img.id);
                      }}
                      disabled={img.status === 'processing'}
                      title="Ảnh độ phân giải thấp/mờ - Nhấn để AI tăng nét 2X"
                      className="inline-flex items-center space-x-1 text-[9px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded mt-1 shadow-2xs transition"
                    >
                      {img.status === 'processing' ? (
                        <>
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-700" />
                          <span>Đang xử lý...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                          <span>AI Tăng nét (2X)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(img.id);
                  }}
                  title="Xóa ảnh khỏi danh sách"
                  className="absolute right-2 top-2 p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button when items are selected */}
      {selectedImageIds.length > 0 && (
        <div className="p-3 border-t border-slate-200 bg-gradient-to-t from-emerald-50 via-teal-50/60 to-white animate-in slide-in-from-bottom-2 duration-150">
          <button
            onClick={() => openGalleryPreview()}
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2 active:scale-98 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>AI Chèn logo {selectedImageIds.length} ảnh đã chọn</span>
          </button>
        </div>
      )}
    </aside>
  );
};
