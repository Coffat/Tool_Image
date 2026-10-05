import React, { useState } from 'react';
import { Phone, ShieldCheck, Sparkles, Check } from 'lucide-react';

export const Footer: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const phoneNumber = '0844922223';
  const displayPhone = '0844 922 223';

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(phoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tickerItems = (
    <div className="inline-flex items-center space-x-6 text-xs text-slate-300">
      <span className="inline-flex items-center space-x-1.5 font-medium text-emerald-400">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Phiên bản v1.0</span>
      </span>
      <span className="text-slate-500">•</span>
      <span className="inline-flex items-center space-x-1.5 text-slate-200">
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
        <span>Bản quyền thuộc về <strong className="font-semibold text-white tracking-wide">Coftech</strong></span>
      </span>
      <span className="text-slate-500">•</span>
      <span className="inline-flex items-center space-x-1.5 text-amber-300">
        <Phone className="w-3.5 h-3.5" />
        <span>LH tư vấn & hỗ trợ: <strong className="font-semibold text-white tracking-wider">{displayPhone}</strong></span>
      </span>
      <span className="text-slate-500">•</span>
      <span className="text-slate-400 text-[11px]">
        Phần mềm đóng dấu & nâng cấp ảnh hàng loạt
      </span>
      <span className="text-slate-500 mr-6">•</span>
    </div>
  );

  return (
    <footer className="h-7 bg-[#071322] border-t border-slate-800/80 text-slate-300 flex items-center justify-between px-3 select-none shrink-0 text-xs overflow-hidden shadow-inner">
      {/* Left badge */}
      <div className="flex items-center space-x-2 shrink-0 pr-3 z-10 bg-[#071322]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">Hệ thống sẵn sàng</span>
      </div>

      {/* Center: Running marquee text */}
      <div className="flex-1 overflow-hidden relative flex items-center mx-2">
        <div className="animate-marquee whitespace-nowrap flex items-center cursor-default hover:[animation-play-state:paused]">
          {tickerItems}
          {tickerItems}
        </div>
      </div>

      {/* Right: Quick action / Contact */}
      <div className="flex items-center space-x-2 shrink-0 pl-3 z-10 bg-[#071322]">
        <button
          onClick={handleCopyPhone}
          title="Nhấp để sao chép số điện thoại liên hệ"
          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 transition-colors text-[11px]"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Đã chép SĐT!</span>
            </>
          ) : (
            <>
              <Phone className="w-3 h-3 text-amber-400" />
              <span>LH: <strong className="font-semibold text-amber-300">{displayPhone}</strong></span>
            </>
          )}
        </button>
      </div>
    </footer>
  );
};
