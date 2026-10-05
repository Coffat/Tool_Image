import React, { useState } from 'react';
import {
  Plus,
  Sliders,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  Folder,
  BookmarkPlus,
  Trash2,
  Check,
  Sparkles,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { usePresetStore } from '../../stores/presetStore';
import { NINE_ANCHOR_POSITIONS } from '../../../shared/constants';
import { NineAnchorPosition } from '../../../shared/types';
import { pickCustomLogo } from '../../utils/filePicker';

export const LogoPanel: React.FC = () => {
  const {
    images,
    activeImageId,
    brandLogos,
    activeLogoId,
    setActiveLogo,
    logoTransform,
    updateLogoTransform,
    setAnchorPosition,
    resetLogoTransform,
    exportOptions,
    setExportOptions,
  } = useEditorStore();

  const { presets, activePresetId, applyPreset, saveCurrentAsPreset, deletePreset } =
    usePresetStore();

  const [newPresetName, setNewPresetName] = useState('');
  const [showSavePresetInput, setShowSavePresetInput] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [smartTip, setSmartTip] = useState<string | null>(null);

  const handleSmartPlacement = async () => {
    const currentImage = images.find((i) => i.id === activeImageId);
    if (!currentImage || !currentImage.filePath) {
      alert('Vui lòng chọn một ảnh sản phẩm để AI gợi ý vị trí.');
      return;
    }

    if (window.electronAPI?.detectSmartPlacement) {
      setIsDetecting(true);
      try {
        const res = await window.electronAPI.detectSmartPlacement(currentImage.filePath);
        if (res) {
          updateLogoTransform(
            {
              x: res.x,
              y: res.y,
              width: res.scale,
              height: res.scale,
            },
            true
          );
          setSmartTip(res.description);
          setTimeout(() => setSmartTip(null), 3500);
        }
      } catch (err: any) {
        alert(`Lỗi khi phân tích ảnh: ${err.message}`);
      } finally {
        setIsDetecting(false);
      }
    }
  };

  // Add custom logo file dialog
  const handleAddLogo = async () => {
    await pickCustomLogo();
  };

  // Select output folder dialog
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

  const handleSavePresetSubmit = async () => {
    if (!newPresetName.trim()) return;
    await saveCurrentAsPreset(newPresetName.trim());
    setNewPresetName('');
    setShowSavePresetInput(false);
  };

  return (
    <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 select-none overflow-y-auto">
      {/* SECTION 1: BRAND LOGO SELECTOR */}
      <div className="p-3.5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Thương Hiệu
          </h2>
          <button
            onClick={handleAddLogo}
            className="flex items-center space-x-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm logo</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {brandLogos.map((logo) => {
            const isSelected = logo.id === activeLogoId;
            return (
              <div
                key={logo.id}
                onClick={() => setActiveLogo(logo.id)}
                className={`relative p-2 rounded-lg border text-center cursor-pointer transition ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                }`}
              >
                <div className="h-14 flex items-center justify-center mb-1">
                  <img
                    src={logo.previewUrl}
                    alt={logo.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="text-[10px] font-medium text-slate-700 truncate">
                  {logo.name}
                </p>
                {logo.isDefault && (
                  <span className="text-[9px] text-emerald-600 font-bold block">
                    Mặc định
                  </span>
                )}
                {isSelected && (
                  <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: 9 ANCHOR POSITIONS */}
      <div className="p-3.5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Vị Trí Logo
          </h3>
          <button
            onClick={handleSmartPlacement}
            disabled={isDetecting || !activeImageId}
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-bold shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Tự động phân tích ảnh và đặt logo vào khoảng trống vàng đẹp nhất"
          >
            <Sparkles className={`w-3 h-3 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>{isDetecting ? 'Đang tìm...' : 'AI Gợi ý góc đẹp'}</span>
          </button>
        </div>

        {smartTip && (
          <div className="mb-2 p-1.5 bg-emerald-50 border border-emerald-200 rounded-md text-[10px] text-emerald-800 font-medium flex items-center space-x-1 animate-in fade-in">
            <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>{smartTip}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
          {NINE_ANCHOR_POSITIONS.map((pos) => (
            <button
              key={pos.id}
              onClick={() => setAnchorPosition(pos.id as NineAnchorPosition)}
              className="py-1.5 px-1 bg-white hover:bg-emerald-500 hover:text-white border border-slate-200 hover:border-emerald-500 rounded text-[10px] font-medium text-slate-700 transition active:scale-95"
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 3: LOGO TRANSFORM PROPERTIES */}
      <div className="p-3.5 border-b border-slate-200 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Thuộc Tính Logo</span>
          </h3>
          <button
            onClick={resetLogoTransform}
            className="text-[11px] text-slate-500 hover:text-slate-700 font-medium flex items-center space-x-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Đặt lại</span>
          </button>
        </div>

        {/* Size Slider */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
            <span>Kích thước</span>
            <span className="font-mono text-emerald-600 font-bold">
              {Math.round(logoTransform.width * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.80"
            step="0.01"
            value={logoTransform.width}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateLogoTransform({ width: val, height: val }, false);
            }}
            onMouseUp={() => updateLogoTransform({}, true)}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>

        {/* Opacity Slider */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
            <span>Độ trong suốt (Opacity)</span>
            <span className="font-mono text-emerald-600 font-bold">
              {Math.round(logoTransform.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.05"
            max="1.0"
            step="0.01"
            value={logoTransform.opacity}
            onChange={(e) =>
              updateLogoTransform({ opacity: parseFloat(e.target.value) }, false)
            }
            onMouseUp={() => updateLogoTransform({}, true)}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>

        {/* Rotation Slider */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
            <span>Góc xoay</span>
            <span className="font-mono text-emerald-600 font-bold">
              {logoTransform.rotation}°
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={logoTransform.rotation}
            onChange={(e) =>
              updateLogoTransform({ rotation: parseInt(e.target.value, 10) }, false)
            }
            onMouseUp={() => updateLogoTransform({}, true)}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>

        {/* Keep Aspect Ratio Checkbox */}
        <div className="flex items-center space-x-2 pt-1">
          <input
            type="checkbox"
            id="keepAspect"
            checked={logoTransform.keepAspectRatio}
            onChange={(e) =>
              updateLogoTransform({ keepAspectRatio: e.target.checked }, true)
            }
            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
          />
          <label htmlFor="keepAspect" className="text-xs font-medium text-slate-700 cursor-pointer">
            Giữ đúng tỷ lệ logo
          </label>
        </div>

        {/* Flip Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() =>
              updateLogoTransform({ flipX: !logoTransform.flipX }, true)
            }
            className={`flex items-center justify-center space-x-1 py-1.5 border rounded text-xs font-medium transition ${
              logoTransform.flipX
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span>Lật ngang</span>
          </button>

          <button
            onClick={() =>
              updateLogoTransform({ flipY: !logoTransform.flipY }, true)
            }
            className={`flex items-center justify-center space-x-1 py-1.5 border rounded text-xs font-medium transition ${
              logoTransform.flipY
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FlipVertical className="w-3.5 h-3.5" />
            <span>Lật dọc</span>
          </button>
        </div>
      </div>

      {/* SECTION 4: PRESETS */}
      <div className="p-3.5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Mẫu Cấu Hình (Preset)
          </h3>
          <button
            onClick={() => setShowSavePresetInput(!showSavePresetInput)}
            className="flex items-center space-x-1 text-[11px] text-blue-600 hover:text-blue-700 font-semibold"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Lưu mẫu</span>
          </button>
        </div>

        {showSavePresetInput && (
          <div className="mb-2.5 p-2 bg-blue-50 border border-blue-200 rounded-md">
            <input
              type="text"
              placeholder="Nhập tên Preset..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="w-full text-xs px-2 py-1 border border-slate-300 rounded mb-1.5 bg-white"
            />
            <div className="flex justify-end space-x-1.5">
              <button
                onClick={() => setShowSavePresetInput(false)}
                className="px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200 rounded"
              >
                Hủy
              </button>
              <button
                onClick={handleSavePresetSubmit}
                className="px-2 py-0.5 text-[10px] bg-blue-600 text-white rounded font-medium"
              >
                Lưu
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {presets.map((pr) => {
            const isSelected = pr.id === activePresetId;
            return (
              <div
                key={pr.id}
                onClick={() => applyPreset(pr.id)}
                className={`flex items-center justify-between p-2 rounded-lg border text-xs font-medium cursor-pointer transition ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800 ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <span className="truncate pr-2">{pr.name}</span>
                {pr.id.startsWith('preset-') && !['preset-fb', 'preset-zalo', 'preset-ecommerce'].includes(pr.id) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePreset(pr.id);
                    }}
                    className="text-slate-400 hover:text-red-500 p-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 5: EXPORT CONFIG */}
      <div className="p-3.5 space-y-3.5 bg-slate-50/70 mt-auto border-t border-slate-200">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Cấu Hình Xuất Ảnh
        </h3>

        {/* Format Selection Tabs */}
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Định dạng xuất
          </label>
          <div className="grid grid-cols-3 gap-1 bg-slate-200 p-0.5 rounded-md text-xs font-semibold">
            {(['jpeg', 'png', 'webp'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setExportOptions({ format: fmt })}
                className={`py-1 rounded uppercase tracking-wider transition ${
                  exportOptions.format === fmt
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {fmt === 'jpeg' ? 'JPG' : fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Quality Slider (for JPG & WebP) */}
        {exportOptions.format !== 'png' && (
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
              <span>Chất lượng (Quality)</span>
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
            onChange={(e) => setExportOptions({ filenameSuffix: e.target.value })}
            className="w-full text-xs font-mono px-2.5 py-1.5 border border-slate-300 rounded bg-white"
            placeholder="-branded"
          />
        </div>

        {/* Output Directory Picker */}
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Thư mục xuất ảnh
          </label>
          <div className="flex items-center space-x-1.5">
            <input
              type="text"
              readOnly
              value={exportOptions.outputFolder || 'Thư mục ảnh gốc (mặc định)'}
              className="flex-1 text-[11px] px-2 py-1.5 border border-slate-300 rounded bg-white text-slate-600 truncate"
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
    </aside>
  );
};
