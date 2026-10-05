import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  X,
  Wifi,
  Copy,
  Check,
  FolderOpen,
  Camera,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';

export const IphoneSyncModal: React.FC = () => {
  const { isIphoneModalOpen, setIphoneModalOpen, iphoneStatus, setIphoneStatus } = useEditorStore();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isIphoneModalOpen) return;

    async function fetchStatus() {
      if (window.electronAPI?.startIphoneSync) {
        setLoading(true);
        try {
          const status = await window.electronAPI.startIphoneSync();
          setIphoneStatus(status);
        } catch (err) {
          console.error('Failed to start iPhone sync server:', err);
        } finally {
          setLoading(false);
        }
      }
    }

    fetchStatus();
  }, [isIphoneModalOpen]);

  if (!isIphoneModalOpen) return null;

  const handleCopyUrl = () => {
    if (iphoneStatus?.url) {
      navigator.clipboard.writeText(iphoneStatus.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenFolder = () => {
    window.electronAPI?.openIphoneFolder?.();
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      if (window.electronAPI?.startIphoneSync) {
        const status = await window.electronAPI.startIphoneSync();
        setIphoneStatus(status);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-brand-navy to-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold">Chuyển ảnh nhanh từ iPhone</h3>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Wifi className="w-2.5 h-2.5" />
                  <span>Wi-Fi LAN</span>
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Quét mã QR bằng Camera iPhone để gửi ảnh tức thì sang Studio
              </p>
            </div>
          </div>
          <button
            onClick={() => setIphoneModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left Col: QR Code Card */}
            <div className="md:col-span-6 flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="relative p-2.5 bg-white rounded-xl shadow-md border border-slate-200 group">
                {iphoneStatus?.qrCodeDataUrl ? (
                  <img
                    src={iphoneStatus.qrCodeDataUrl}
                    alt="Mã QR tải ảnh"
                    className="w-52 h-52 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-52 h-52 flex flex-col items-center justify-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin mb-2 text-emerald-600" />
                    <span className="text-xs">Đang tạo mã QR...</span>
                  </div>
                )}
                {/* Visual badge in center or corner */}
                <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-1.5 rounded-full shadow-lg">
                  <Camera className="w-4 h-4" />
                </div>
              </div>

              {/* Direct Link */}
              <div className="mt-4 w-full">
                <p className="text-[11px] font-semibold text-slate-500 mb-1">
                  HOẶC TRUY CẬP ĐỊA CHỈ TRÊN SAFARI:
                </p>
                <div className="flex items-center space-x-1.5 p-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
                  <input
                    type="text"
                    readOnly
                    value={iphoneStatus?.url || 'Đang lấy địa chỉ...'}
                    className="flex-1 text-xs font-mono text-slate-700 bg-transparent px-2 outline-none select-all"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                    title="Sao chép liên kết"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Col: Instructions & Live Stats */}
            <div className="md:col-span-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Kết nối chung Wi-Fi</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Đảm bảo iPhone và máy Mac đang kết nối cùng một mạng Wi-Fi nội bộ.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Quét mã bằng Camera</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Bật ứng dụng <strong>Camera</strong> trên iPhone, hướng vào mã QR và chạm vào liên kết màu vàng hiển thị trên màn hình.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Chọn hoặc Chụp ảnh gửi ngay</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Bấm nút tải ảnh trên điện thoại. Ảnh gốc (kể cả HEIC) sẽ tự động nạp vào nhóm <strong>"iPhone Uploads"</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Box */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-900 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Trạng thái kết nối</span>
                  </span>
                  <span className="text-emerald-700 font-bold">Sẵn sàng nhận ảnh</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600 border-t border-emerald-200/60 pt-2">
                  <span>Số ảnh đã nhận phiên này:</span>
                  <span className="font-bold text-slate-900 text-sm bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                    {iphoneStatus?.receivedCount || 0} ảnh
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={handleOpenFolder}
                  className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  <FolderOpen className="w-4 h-4 text-slate-500" />
                  <span>Mở thư mục ảnh</span>
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
                  title="Làm mới kết nối"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Chuyển trực tiếp qua Wi-Fi nội bộ - Tốc độ cao & Bảo mật</span>
          </div>
          <button
            onClick={() => setIphoneModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
