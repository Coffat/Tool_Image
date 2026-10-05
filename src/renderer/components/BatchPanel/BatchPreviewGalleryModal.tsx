import React from 'react';
import {
  X,
  Sparkles,
  RefreshCw,
  FolderOpen,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { useBatchStore } from '../../stores/batchStore';
import { useEditorStore } from '../../stores/editorStore';

export const BatchPreviewGalleryModal: React.FC = () => {
  const {
    isGalleryPreviewOpen,
    closeGalleryPreview,
    smartPlacements,
    isAnalyzingSmartPlacements,
    analyzeSmartPlacements,
    updateItemCorner,
    removeItemFromGallery,
    startBatchExport,
  } = useBatchStore();

  const {
    images,
    selectedImageIds,
    brandLogos,
    activeLogoId,
    logoTransform,
    exportOptions,
    setExportOptions,
  } = useEditorStore();

  if (!isGalleryPreviewOpen) return null;

  const targetImages =
    selectedImageIds.length > 0
      ? images.filter((img) => selectedImageIds.includes(img.id))
      : images;

  const activeLogo = brandLogos.find((l) => l.id === activeLogoId) || brandLogos[0];

  const handleSelectFolder = async () => {
    if (window.electronAPI?.selectOutputFolder) {
      const folder = await window.electronAPI.selectOutputFolder();
      if (folder) {
        setExportOptions({ outputFolder: folder });
      }
    }
  };

  const getCornerStyle = (corner: string, scale: number) => {
    const widthPercent = Math.round(scale * 100);
    const paddingPx = 8;

    switch (corner) {
      case 'top-left':
        return { top: paddingPx, left: paddingPx, width: `${widthPercent}%` };
      case 'top-right':
        return { top: paddingPx, right: paddingPx, width: `${widthPercent}%` };
      case 'bottom-left':
        return { bottom: paddingPx, left: paddingPx, width: `${widthPercent}%` };
      case 'bottom-right':
      default:
        return { bottom: paddingPx, right: paddingPx, width: `${widthPercent}%` };
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl flex flex-col h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 via-brand-navy to-slate-900 text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold">Lưới Xem Trước Ảnh Gắn Logo AI</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {targetImages.length} ảnh đã chọn
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Kiểm tra trực quan vị trí logo trước khi xuất hàng loạt. Bấm các nút góc bên dưới từng ảnh để đổi nhanh nếu muốn.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => analyzeSmartPlacements()}
              disabled={isAnalyzingSmartPlacements}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition disabled:opacity-50"
              title="Quét lại vị trí tối ưu cho toàn bộ ảnh"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isAnalyzingSmartPlacements ? 'animate-spin' : ''}`}
              />
              <span>{isAnalyzingSmartPlacements ? 'Đang phân tích...' : 'Quét lại góc AI'}</span>
            </button>

            <button
              onClick={closeGalleryPreview}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Gallery Grid */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {targetImages.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <p className="text-sm font-medium">Chưa có ảnh nào được chọn</p>
              <p className="text-xs text-slate-400 mt-1">
                Vui lòng chọn ít nhất 1 ảnh từ danh sách bên trái.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {targetImages.map((img, idx) => {
                const smart = smartPlacements[img.filePath] || {
                  corner: 'top-right',
                  cornerLabel: 'Góc trên - phải',
                  scale: 0.20,
                  x: 0.85,
                  y: 0.15,
                  confidence: 1.0,
                  description: 'Vị trí mặc định',
                };

                const currentCorner = smart.corner;
                const overlayStyle = getCornerStyle(currentCorner, smart.scale || 0.20);

                return (
                  <div
                    key={img.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition flex flex-col group relative"
                  >
                    {/* Index & Remove Button */}
                    <div className="absolute top-2 left-2 z-20 flex items-center space-x-1">
                      <span className="bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                        #{idx + 1}
                      </span>
                    </div>

                    <button
                      onClick={() => removeItemFromGallery(img.id)}
                      title="Bỏ qua ảnh này trong đợt xuất"
                      className="absolute top-2 right-2 z-20 p-1 rounded-md bg-white/80 hover:bg-red-500 hover:text-white text-slate-600 shadow-xs opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Image Preview Canvas Box with Overlayed Logo */}
                    <div className="relative aspect-4/3 bg-slate-100 overflow-hidden flex items-center justify-center">
                      <img
                        src={img.previewUrl}
                        alt={img.fileName}
                        className="w-full h-full object-contain pointer-events-none select-none"
                      />

                      {/* Overlaid Logo */}
                      {activeLogo && (
                        <div
                          className="absolute pointer-events-none select-none transition-all duration-200"
                          style={{
                            ...overlayStyle,
                            opacity: logoTransform.opacity,
                            transform: `rotate(${logoTransform.rotation}deg) scaleX(${
                              logoTransform.flipX ? -1 : 1
                            }) scaleY(${logoTransform.flipY ? -1 : 1})`,
                          }}
                        >
                          <img
                            src={activeLogo.previewUrl}
                            alt="Logo overlay"
                            className="w-full h-auto drop-shadow-md"
                          />
                        </div>
                      )}
                    </div>

                    {/* Card Content & Quick Corner Switcher */}
                    <div className="p-3 flex flex-col justify-between flex-1 border-t border-slate-100">
                      <div>
                        <p
                          className="text-xs font-semibold text-slate-800 truncate"
                          title={img.fileName}
                        >
                          {img.fileName}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                            <span>
                              {smart.cornerLabel} ({Math.round(smart.scale * 100)}%)
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* 4 Corner Quick Switcher Buttons */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                        <span className="text-[10px] text-slate-400 font-medium">Đổi góc:</span>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => updateItemCorner(img.filePath, 'top-left')}
                            title="Chuyển sang Góc trên - trái"
                            className={`p-1 rounded text-xs transition ${
                              currentCorner === 'top-left'
                                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                          >
                            <ArrowUpLeft className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => updateItemCorner(img.filePath, 'top-right')}
                            title="Chuyển sang Góc trên - phải"
                            className={`p-1 rounded text-xs transition ${
                              currentCorner === 'top-right'
                                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => updateItemCorner(img.filePath, 'bottom-left')}
                            title="Chuyển sang Góc dưới - trái"
                            className={`p-1 rounded text-xs transition ${
                              currentCorner === 'bottom-left'
                                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => updateItemCorner(img.filePath, 'bottom-right')}
                            title="Chuyển sang Góc dưới - phải"
                            className={`p-1 rounded text-xs transition ${
                              currentCorner === 'bottom-right'
                                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                          >
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Thư mục xuất:</span>
            <span
              className="font-mono text-slate-500 max-w-sm truncate bg-slate-100 px-2 py-1 rounded border border-slate-200"
              title={exportOptions.outputFolder || 'Cùng thư mục ảnh gốc'}
            >
              {exportOptions.outputFolder || 'Mặc định (Thư mục ảnh gốc)'}
            </span>
            <button
              onClick={handleSelectFolder}
              className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
              title="Đổi thư mục lưu ảnh"
            >
              <FolderOpen className="w-4 h-4 text-emerald-600" />
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={closeGalleryPreview}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
            >
              Đóng lại
            </button>

            <button
              onClick={() => startBatchExport(true)}
              disabled={targetImages.length === 0}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Xuất hàng loạt {targetImages.length} ảnh đã duyệt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
