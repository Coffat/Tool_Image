import React from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, StopCircle, Sparkles, RefreshCw, Smartphone } from 'lucide-react';
import { useBatchStore } from '../../stores/batchStore';
import { useEditorStore } from '../../stores/editorStore';

export const BatchModal: React.FC = () => {
  const {
    isOpen,
    isProcessing,
    autoEnhanceLowRes,
    smartPlacementEnabled,
    smartPlacements,
    isAnalyzingSmartPlacements,
    progress,
    summary,
    closeModal,
    setAutoEnhanceLowRes,
    setSmartPlacementEnabled,
    analyzeSmartPlacements,
    startBatchExport,
    cancelBatchExport,
  } = useBatchStore();

  const { images } = useEditorStore();

  if (!isOpen) return null;

  const total = progress?.total || images.length;
  const current = progress?.index || 0;
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Xử Lý Ảnh Hàng Loạt
            </h3>
            <p className="text-xs text-slate-500">
              Gắn logo thương hiệu và xuất đồng thời {images.length} ảnh sản phẩm
            </p>
          </div>
          {!isProcessing && (
            <button
              onClick={closeModal}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Progress Overview */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
              <span>
                {isProcessing
                  ? `Đang xử lý: ${current} / ${total} ảnh`
                  : summary
                  ? summary.isCancelled
                    ? 'Đã dừng xử lý hàng loạt'
                    : 'Hoàn tất xử lý hàng loạt!'
                  : 'Sẵn sàng bắt đầu xuất'}
              </span>
              <span className="font-mono text-emerald-600 font-bold text-sm">
                {percent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>

            {progress && isProcessing && (
              <p className="text-[11px] text-slate-500 mt-2 truncate font-mono">
                Đang xử lý: {progress.currentFilePath}
              </p>
            )}
          </div>

          {/* AI Smart Placement Option */}
          {!isProcessing && !summary && (
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/90 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs font-bold text-teal-950">
                      Tự động tìm vị trí thông minh cho từng ảnh (AI Smart Placement)
                    </h4>
                    <span className="text-[10px] font-bold bg-teal-200/70 text-teal-900 px-1.5 py-0.2 rounded-full">
                      Khuyên dùng
                    </span>
                  </div>
                  <p className="text-[11px] text-teal-800">
                    Tự quét 4 góc từng bức ảnh, tìm vùng nền trống trải nhất để né nhãn thuốc và tự co giãn kích thước logo vừa vặn.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                <input
                  type="checkbox"
                  checked={smartPlacementEnabled}
                  onChange={(e) => setSmartPlacementEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>
          )}

          {/* AI Auto Enhance Option */}
          {!isProcessing && !summary && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    Tự động tăng nét AI cho ảnh nhỏ (&lt; 1600px)
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Phóng to 2X chi tiết bằng thuật toán Lanczos-3 &amp; Unsharp Mask offline.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                <input
                  type="checkbox"
                  checked={autoEnhanceLowRes}
                  onChange={(e) => setAutoEnhanceLowRes(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          )}

          {/* Results / File List with Smart Placement badges */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Danh Sách File ({images.length})
              </h4>
              {smartPlacementEnabled && !isProcessing && (
                <button
                  onClick={() => analyzeSmartPlacements()}
                  disabled={isAnalyzingSmartPlacements}
                  className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isAnalyzingSmartPlacements ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzingSmartPlacements ? 'Đang phân tích...' : 'Quét lại góc'}</span>
                </button>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-52 overflow-y-auto bg-white text-xs">
              {summary?.results ? (
                summary.results.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 flex items-center justify-between hover:bg-slate-50"
                  >
                    <div className="flex items-center space-x-2 truncate pr-4">
                      {res.status === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      {res.status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      {res.status === 'cancelled' && (
                        <StopCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate font-medium text-slate-700">
                        {res.filePath}
                      </span>
                    </div>

                    <div className="shrink-0 text-right">
                      {res.status === 'success' && (
                        <span className="text-[11px] font-semibold text-emerald-600">
                          Thành công
                        </span>
                      )}
                      {res.status === 'error' && (
                        <span className="text-[11px] font-semibold text-red-600" title={res.error}>
                          {res.error || 'Lỗi'}
                        </span>
                      )}
                      {res.status === 'cancelled' && (
                        <span className="text-[11px] font-semibold text-amber-600">
                          Đã hủy
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                images.map((img, idx) => {
                  const smart = smartPlacementEnabled ? smartPlacements[img.filePath] : null;

                  return (
                    <div
                      key={img.id}
                      className="p-2.5 flex items-center justify-between hover:bg-slate-50 gap-2"
                    >
                      <span className="truncate text-slate-700 font-medium">
                        {idx + 1}. {img.fileName}
                      </span>
                      <div className="shrink-0 flex items-center space-x-1.5">
                        {smartPlacementEnabled ? (
                          smart ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-800 border border-teal-200">
                              <Sparkles className="w-2.5 h-2.5 text-teal-600" />
                              <span>
                                {smart.cornerLabel} ({Math.round(smart.scale * 100)}%)
                              </span>
                            </span>
                          ) : isAnalyzingSmartPlacements ? (
                            <span className="text-[10px] text-slate-400 font-mono animate-pulse">
                              Đang tính góc...
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Góc mặc định</span>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-400">Theo góc đã chọn</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Summary Box when Done */}
          {summary && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-xl font-bold text-emerald-700 block">
                  {summary.successCount}
                </span>
                <span className="text-[10px] font-semibold text-emerald-800 uppercase">
                  Thành công
                </span>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <span className="text-xl font-bold text-red-700 block">
                  {summary.errorCount}
                </span>
                <span className="text-[10px] font-semibold text-red-800 uppercase">
                  Lỗi
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xl font-bold text-slate-700 block">
                  {summary.total}
                </span>
                <span className="text-[10px] font-semibold text-slate-600 uppercase">
                  Tổng số ảnh
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {isProcessing ? 'Vui lòng không đóng cửa sổ khi đang xuất...' : 'Ảnh sẽ xuất ra thư mục đã chọn'}
          </span>

          <div className="flex items-center space-x-2">
            {isProcessing ? (
              <button
                onClick={cancelBatchExport}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition"
              >
                <StopCircle className="w-4 h-4" />
                <span>Dừng lại</span>
              </button>
            ) : (
              <>
                {summary && summary.successCount > 0 && (
                  <button
                    onClick={() => {
                      closeModal();
                      useEditorStore.getState().setIphoneModalOpen(true);
                    }}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-brand-navy hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Tải về điện thoại qua QR</span>
                  </button>
                )}
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-medium text-slate-700 transition"
                >
                  {summary ? 'Đóng' : 'Hủy bỏ'}
                </button>
                {!summary && (
                  <button
                    onClick={() => startBatchExport()}
                    disabled={images.length === 0}
                    className="flex items-center space-x-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    <Loader2 className="w-4 h-4 hidden" />
                    <span>Bắt đầu xuất hàng loạt</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
