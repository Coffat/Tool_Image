import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, DownloadCloud } from 'lucide-react';

export const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<{
    status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
    version?: string;
    percent?: number;
    error?: string;
  }>({ status: 'idle' });

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let unsubStatus: (() => void) | undefined;
    let unsubProgress: (() => void) | undefined;

    if (window.electronAPI?.onUpdaterStatus) {
      unsubStatus = window.electronAPI.onUpdaterStatus((data) => {
        if (data.status === 'available') {
          setUpdateInfo({ status: 'downloading', version: data.version, percent: 0 });
          setDismissed(false);
        } else if (data.status === 'downloaded') {
          setUpdateInfo({ status: 'downloaded', version: data.version });
          setDismissed(false);
        }
      });
    }

    if (window.electronAPI?.onUpdaterProgress) {
      unsubProgress = window.electronAPI.onUpdaterProgress((data) => {
        setUpdateInfo((prev) => ({
          ...prev,
          status: 'downloading',
          percent: data.percent,
        }));
      });
    }

    return () => {
      unsubStatus?.();
      unsubProgress?.();
    };
  }, []);

  if (dismissed || updateInfo.status === 'idle') return null;

  const handleRestart = () => {
    window.electronAPI?.quitAndInstallUpdate?.();
  };

  return (
    <div className="fixed bottom-10 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center space-x-3.5 max-w-md">
        {updateInfo.status === 'downloading' && (
          <>
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <DownloadCloud className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs font-bold text-white">
                Đang tải bản cập nhật v{updateInfo.version || 'mới'}
              </p>
              <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${updateInfo.percent || 0}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Tiến độ: {updateInfo.percent || 0}% từ GitHub
              </p>
            </div>
          </>
        )}

        {updateInfo.status === 'downloaded' && (
          <>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs font-bold text-white">
                Bản cập nhật v{updateInfo.version} đã sẵn sàng!
              </p>
              <p className="text-[10px] text-slate-300 mt-0.5">
                Khởi động lại ứng dụng để áp dụng tính năng mới.
              </p>
            </div>
            <button
              onClick={handleRestart}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition shrink-0 cursor-pointer"
            >
              Cập nhật ngay
            </button>
          </>
        )}

        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
