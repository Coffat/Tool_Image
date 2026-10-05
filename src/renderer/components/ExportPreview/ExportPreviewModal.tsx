import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Download,
  Loader2,
  Folder,
  ArrowRight,
  SlidersHorizontal,
  SplitSquareHorizontal,
  ToggleLeft,
  ZoomIn,
} from 'lucide-react';
import { useExportPreviewStore } from '../../stores/exportPreviewStore';
import { useEditorStore } from '../../stores/editorStore';
import { formatLocalImageUrl } from '../../../shared/formatUrl';

export const ExportPreviewModal: React.FC = () => {
  const {
    isOpen,
    applyAiEnhance,
    compareSliderPos,
    compareMode,
    toggleView,
    isGeneratingEnhancedPreview,
    enhancedPreviewUrl,
    enhancedWidth,
    enhancedHeight,
    isExporting,
    closeModal,
    setApplyAiEnhance,
    setCompareSliderPos,
    setCompareMode,
    setToggleView,
    setEnhancedData,
    setIsGeneratingEnhancedPreview,
    setIsExporting,
  } = useExportPreviewStore();

  const {
    images,
    activeImageId,
    brandLogos,
    activeLogoId,
    logoTransform,
    exportOptions,
    setExportOptions,
    enhanceImageAction,
  } = useEditorStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isZoom100, setIsZoom100] = useState(false);
  const previewBoxRef = useRef<HTMLDivElement>(null);

  const activeImg = images.find((i) => i.id === activeImageId);
  const activeLogo =
    brandLogos.find((l) => l.id === activeLogoId) || brandLogos[0];

  // When modal opens or applyAiEnhance toggles on, ensure enhanced version is generated
  useEffect(() => {
    if (!isOpen || !activeImg) return;

    // If image already enhanced previously
    if (activeImg.isEnhanced) {
      setEnhancedData(activeImg.previewUrl, activeImg.originalWidth, activeImg.originalHeight);
      return;
    }

    if (applyAiEnhance && !enhancedPreviewUrl) {
      let isMounted = true;
      setIsGeneratingEnhancedPreview(true);

      if (window.electronAPI?.enhanceImage) {
        window.electronAPI
          .enhanceImage(activeImg.filePath)
          .then((res) => {
            if (isMounted) {
              const url = `${formatLocalImageUrl(res.enhancedPath)}?t=${Date.now()}`;
              setEnhancedData(url, res.newWidth, res.newHeight);
              setIsGeneratingEnhancedPreview(false);
            }
          })
          .catch((err) => {
            console.error('Failed to generate enhanced preview:', err);
            if (isMounted) setIsGeneratingEnhancedPreview(false);
          });
      } else {
        setIsGeneratingEnhancedPreview(false);
      }

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, applyAiEnhance, activeImg?.id]);

  if (!isOpen || !activeImg) return null;

  // Handle Dragging Split Slider
  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !previewBoxRef.current) return;
    const rect = previewBoxRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setCompareSliderPos(percent);
  };

  const handleSelectOutputFolder = async () => {
    try {
      if (window.electronAPI?.selectOutputFolder) {
        const folder = await window.electronAPI.selectOutputFolder();
        if (folder) {
          setExportOptions({ outputFolder: folder });
        }
      }
    } catch (err) {
      console.error('Error selecting output folder:', err);
    }
  };

  // Perform Final Export
  const handleConfirmExport = async () => {
    if (!window.electronAPI?.exportSingle) {
      alert('Không tìm thấy môi trường Electron để xuất ảnh.');
      return;
    }

    if (!activeLogo) {
      alert('Vui lòng chọn logo hợp lệ trước khi xuất.');
      return;
    }

    setIsExporting(true);

    try {
      let finalImagePath = activeImg.filePath;

      // If user enabled AI enhance, apply enhancement first if not already done
      if (applyAiEnhance && !activeImg.isEnhanced) {
        const enhanceResult = await window.electronAPI.enhanceImage(activeImg.filePath);
        finalImagePath = enhanceResult.enhancedPath;
        // Also update editor store state
        await enhanceImageAction(activeImg.id);
      }

      const res = await window.electronAPI.exportSingle({
        imagePath: finalImagePath,
        logoPath: activeLogo.filePath,
        transform: {
          relCenterX: logoTransform.x,
          relCenterY: logoTransform.y,
          relWidth: logoTransform.width,
          relHeight: logoTransform.height,
          rotation: logoTransform.rotation,
          opacity: logoTransform.opacity,
          flipX: logoTransform.flipX,
          flipY: logoTransform.flipY,
        },
        exportOptions,
      });

      alert(
        `🎉 Xuất ảnh thành công!\n\n` +
          `• Kích thước: ${res.width} × ${res.height} px\n` +
          `• Định dạng: ${exportOptions.format.toUpperCase()}\n` +
          `• Vị trí lưu: ${res.outputPath}`
      );
      closeModal();
    } catch (err: any) {
      console.error('Export failed:', err);
      alert(`Lỗi xuất ảnh: ${err?.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  const targetW = applyAiEnhance
    ? enhancedWidth || activeImg.originalWidth * 2
    : activeImg.originalWidth;
  const targetH = applyAiEnhance
    ? enhancedHeight || activeImg.originalHeight * 2
    : activeImg.originalHeight;

  // Render logo layer inside preview
  const renderLogoOverlay = () => {
    if (!activeLogo?.previewUrl) return null;
    return (
      <img
        src={activeLogo.previewUrl}
        alt="Logo Overlay"
        style={{
          position: 'absolute',
          left: `${logoTransform.x * 100}%`,
          top: `${logoTransform.y * 100}%`,
          width: `${logoTransform.width * 100}%`,
          transform: `translate(-50%, -50%) rotate(${logoTransform.rotation}deg) scale(${
            logoTransform.flipX ? -1 : 1
          }, ${logoTransform.flipY ? -1 : 1})`,
          opacity: logoTransform.opacity,
          pointerEvents: 'none',
        }}
        className="select-none"
      />
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 select-none"
      onMouseUp={handleMouseUp}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-800">
                Xem Trước &amp; Xuất Ảnh Thành Phẩm
              </h3>
              {applyAiEnhance && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>AI Tăng Nét 2X</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Kiểm tra chi tiết hình ảnh, so sánh trước / sau khi tăng nét và cấu hình xuất file.
            </p>
          </div>
          <button
            onClick={closeModal}
            disabled={isExporting}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content: 2-Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Interactive Visual Preview */}
          <div className="flex-1 bg-slate-900/95 flex flex-col p-4 relative overflow-hidden">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between mb-3 z-10">
              <div className="flex items-center space-x-2">
                {applyAiEnhance && (
                  <div className="bg-slate-800/90 rounded-lg p-0.5 flex items-center border border-slate-700 text-xs">
                    <button
                      onClick={() => setCompareMode('split')}
                      className={`px-2.5 py-1 rounded flex items-center space-x-1.5 font-medium transition ${
                        compareMode === 'split'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <SplitSquareHorizontal className="w-3.5 h-3.5" />
                      <span>Trượt So Sánh (Split)</span>
                    </button>
                    <button
                      onClick={() => setCompareMode('toggle')}
                      className={`px-2.5 py-1 rounded flex items-center space-x-1.5 font-medium transition ${
                        compareMode === 'toggle'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <ToggleLeft className="w-3.5 h-3.5" />
                      <span>Chuyển Đổi (Toggle)</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsZoom100(!isZoom100)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center space-x-1.5 transition ${
                    isZoom100
                      ? 'bg-emerald-600/90 border-emerald-500 text-white'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>{isZoom100 ? 'Thu vừa khung' : 'Soi chi tiết 100%'}</span>
                </button>
              </div>
            </div>

            {/* Preview Box Container */}
            <div
              ref={previewBoxRef}
              onMouseMove={handleMouseMove}
              className={`flex-1 relative flex items-center justify-center overflow-auto rounded-xl border border-slate-800 bg-slate-950/60 select-none ${
                isDragging ? 'cursor-ew-resize' : ''
              }`}
            >
              {isGeneratingEnhancedPreview ? (
                <div className="flex flex-col items-center space-y-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <p className="text-xs font-medium text-slate-300">
                    Đang dựng bản mẫu AI tăng nét 2X (Lanczos3 &amp; Unsharp Mask)...
                  </p>
                </div>
              ) : (
                <div
                  className={`relative max-w-full max-h-full transition-transform duration-150 ${
                    isZoom100 ? 'scale-150 origin-center cursor-move' : ''
                  }`}
                  style={{ maxHeight: 'calc(100% - 20px)' }}
                >
                  {/* Mode 1: No AI Enhance -> Normal preview */}
                  {!applyAiEnhance && (
                    <div className="relative inline-block overflow-hidden shadow-2xl rounded-lg">
                      <img
                        src={activeImg.previewUrl}
                        alt="Preview"
                        className="max-h-[62vh] w-auto object-contain block"
                      />
                      {renderLogoOverlay()}
                    </div>
                  )}

                  {/* Mode 2: AI Enhance with Toggle View */}
                  {applyAiEnhance && compareMode === 'toggle' && (
                    <div className="relative inline-block overflow-hidden shadow-2xl rounded-lg">
                      <img
                        src={
                          toggleView === 'after' && enhancedPreviewUrl
                            ? enhancedPreviewUrl
                            : activeImg.previewUrl
                        }
                        alt="Preview"
                        className="max-h-[62vh] w-auto object-contain block"
                      />
                      {renderLogoOverlay()}

                      {/* Floating Toggle Controls */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur border border-slate-700 p-1 rounded-full shadow-lg flex items-center space-x-1 text-xs">
                        <button
                          onClick={() => setToggleView('before')}
                          className={`px-3 py-1 rounded-full font-semibold transition ${
                            toggleView === 'before'
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Ảnh Gốc (Trước)
                        </button>
                        <button
                          onClick={() => setToggleView('after')}
                          className={`px-3 py-1 rounded-full font-semibold transition ${
                            toggleView === 'after'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          ✨ AI Tăng Nét (Sau)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mode 3: AI Enhance with Split Slider */}
                  {applyAiEnhance && compareMode === 'split' && (
                    <div className="relative inline-block overflow-hidden shadow-2xl rounded-lg">
                      {/* Left: Original Before Image */}
                      <img
                        src={activeImg.previewUrl}
                        alt="Before"
                        className="max-h-[62vh] w-auto object-contain block pointer-events-none"
                      />
                      {renderLogoOverlay()}

                      {/* Right: AI Enhanced After Image (Clipped) */}
                      <div
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{
                          clipPath: `inset(0 0 0 ${compareSliderPos}%)`,
                        }}
                      >
                        <img
                          src={enhancedPreviewUrl || activeImg.previewUrl}
                          alt="After"
                          className="max-h-[62vh] w-auto object-contain block"
                        />
                        {renderLogoOverlay()}
                      </div>

                      {/* Draggable Divider Line & Handle */}
                      <div
                        onMouseDown={handleMouseDown}
                        style={{ left: `${compareSliderPos}%` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 z-30 cursor-ew-resize flex items-center justify-center -translate-x-1/2 group"
                      >
                        <div className="w-7 h-7 rounded-full bg-white border-2 border-emerald-500 shadow-xl flex items-center justify-center text-slate-800 font-bold text-[10px] group-hover:scale-110 transition">
                          ⇄
                        </div>
                      </div>

                      {/* Before / After Badges */}
                      <span className="absolute bottom-2 left-2 z-20 px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-slate-300 text-[10px] font-bold">
                        ẢNH GỐC (TRƯỚC)
                      </span>
                      <span className="absolute bottom-2 right-2 z-20 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-[10px] font-bold">
                        AI TĂNG NÉT (SAU)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Note */}
            <div className="mt-2 text-center text-[11px] text-slate-400">
              {applyAiEnhance
                ? 'Kéo thanh trượt ⇄ hoặc chuyển đổi góc nhìn để so sánh độ tương phản và viền chi tiết.'
                : 'Bản xem trước hiển thị logo thương hiệu chính xác theo tỉ lệ và vị trí đã chọn.'}
            </div>
          </div>

          {/* Right Column: Settings & Export Controls */}
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col justify-between p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Card 1: AI Sharpening Toggle */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Tùy Chọn Tăng Nét AI
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyAiEnhance}
                      onChange={(e) => setApplyAiEnhance(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Tăng gấp đôi độ phân giải (2X Super-Resolution), làm rõ chữ và viền sản phẩm bằng thuật toán Lanczos3 &amp; Unsharp Mask offline.
                </p>

                {/* Dimension Comparison */}
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100 flex items-center justify-between text-[11px] font-mono">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-sans">
                      Gốc
                    </span>
                    <span className="font-semibold text-slate-700">
                      {activeImg.originalWidth} × {activeImg.originalHeight}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <div className="text-right">
                    <span className="text-emerald-600 block text-[9px] uppercase font-sans font-bold">
                      {applyAiEnhance ? 'Xuất AI (2X)' : 'Xuất Gốc'}
                    </span>
                    <span className="font-bold text-emerald-700">
                      {targetW} × {targetH} px
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Export Options */}
              <div className="space-y-3 pt-1 border-t border-slate-200">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                  <span>Cấu Hình File Xuất</span>
                </div>

                {/* Format selection */}
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Định dạng file
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                    {(['jpeg', 'png', 'webp'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setExportOptions({ format: fmt })}
                        className={`py-1 rounded uppercase tracking-wider transition ${
                          exportOptions.format === fmt
                            ? 'bg-white text-slate-800 shadow-xs border border-slate-200'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {fmt === 'jpeg' ? 'JPG' : fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quality slider */}
                {exportOptions.format !== 'png' && (
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                      <span>Chất lượng nén</span>
                      <span className="font-mono text-emerald-600 font-bold">
                        {exportOptions.quality}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      step="1"
                      value={exportOptions.quality}
                      onChange={(e) =>
                        setExportOptions({ quality: parseInt(e.target.value, 10) })
                      }
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                )}

                {/* Filename Suffix */}
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Hậu tố tên file
                  </label>
                  <input
                    type="text"
                    value={exportOptions.filenameSuffix}
                    onChange={(e) =>
                      setExportOptions({ filenameSuffix: e.target.value })
                    }
                    className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                    placeholder="-branded"
                  />
                </div>

                {/* Output Directory Picker */}
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Thư mục lưu
                  </label>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      readOnly
                      value={
                        exportOptions.outputFolder || 'Thư mục ảnh gốc (mặc định)'
                      }
                      className="flex-1 text-[11px] px-2 py-1.5 border border-slate-300 rounded bg-slate-50 text-slate-600 truncate"
                    />
                    <button
                      onClick={handleSelectOutputFolder}
                      className="p-1.5 border border-slate-300 hover:bg-slate-100 rounded text-slate-600 transition"
                      title="Chọn thư mục xuất ảnh"
                    >
                      <Folder className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <button
                onClick={handleConfirmExport}
                disabled={isExporting}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition active:scale-98 flex items-center justify-center space-x-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xử lý &amp; Xuất...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Xác Nhận Xuất Ảnh ({targetW} × {targetH})</span>
                  </>
                )}
              </button>

              <button
                onClick={closeModal}
                disabled={isExporting}
                className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
              >
                Quay lại chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
