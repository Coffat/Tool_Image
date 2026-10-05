import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Sparkles, Loader2, X } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { pickImages } from '../../utils/filePicker';

export const CanvasEditor: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const logoRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  const {
    images,
    activeImageId,
    brandLogos,
    activeLogoId,
    logoTransform,
    updateLogoTransform,
    zoom,
    setZoom,
    enhanceImageAction,
    dismissEnhanceSuggestion,
  } = useEditorStore();

  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [baseHtmlImage, setBaseHtmlImage] = useState<HTMLImageElement | null>(null);
  const [logoHtmlImage, setLogoHtmlImage] = useState<HTMLImageElement | null>(null);

  const activeImage = images.find((i) => i.id === activeImageId);
  const activeLogo =
    brandLogos.find((l) => l.id === activeLogoId) || brandLogos[0];

  // 1. Observe container dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // 2. Load Base Product Image
  useEffect(() => {
    if (!activeImage?.previewUrl) {
      setBaseHtmlImage(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      setBaseHtmlImage(img);
    };
    img.onerror = (e) => {
      console.error('[CanvasEditor] Failed to load base image:', activeImage.previewUrl, e);
    };
    img.src = activeImage.previewUrl;
  }, [activeImage?.previewUrl]);

  // 3. Load Brand Logo Image
  useEffect(() => {
    if (!activeLogo?.previewUrl) {
      setLogoHtmlImage(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      setLogoHtmlImage(img);
    };
    img.onerror = (e) => {
      console.error('[CanvasEditor] Failed to load logo image:', activeLogo.previewUrl, e);
    };
    img.src = activeLogo.previewUrl;
  }, [activeLogo?.previewUrl]);

  // 4. Attach Transformer to Logo Node
  useEffect(() => {
    if (trRef.current && logoRef.current) {
      trRef.current.nodes([logoRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [baseHtmlImage, logoHtmlImage, activeImageId]);

  // Calculate base image display bounds on canvas
  let baseDisplayW = 0;
  let baseDisplayH = 0;
  let baseOffsetX = 0;
  let baseOffsetY = 0;

  if (baseHtmlImage && containerSize.width > 0 && containerSize.height > 0) {
    const padding = 40;
    const availW = Math.max(100, containerSize.width - padding);
    const availH = Math.max(100, containerSize.height - padding);

    const naturalW = baseHtmlImage.naturalWidth || 1;
    const naturalH = baseHtmlImage.naturalHeight || 1;
    const aspect = naturalW / naturalH;

    let fittedW = availW;
    let fittedH = availW / aspect;

    if (fittedH > availH) {
      fittedH = availH;
      fittedW = availH * aspect;
    }

    baseDisplayW = fittedW * zoom;
    baseDisplayH = fittedH * zoom;
    baseOffsetX = (containerSize.width - baseDisplayW) / 2;
    baseOffsetY = (containerSize.height - baseDisplayH) / 2;
  }

  // Calculate Logo dimensions and coordinates in canvas space
  const logoPixelW = baseDisplayW * logoTransform.width;
  const logoPixelH = baseDisplayH * logoTransform.height;
  const logoCenterPixelX = baseOffsetX + baseDisplayW * logoTransform.x;
  const logoCenterPixelY = baseOffsetY + baseDisplayH * logoTransform.y;

  // Drag End handler
  const handleDragEnd = (e: any) => {
    if (baseDisplayW <= 0 || baseDisplayH <= 0) return;
    const node = e.target;
    // Current center in canvas
    const newCenterX = node.x();
    const newCenterY = node.y();

    const relX = (newCenterX - baseOffsetX) / baseDisplayW;
    const relY = (newCenterY - baseOffsetY) / baseDisplayH;

    updateLogoTransform({ x: relX, y: relY }, true);
  };

  // Transform (Resize / Rotate) End handler
  const handleTransformEnd = () => {
    const node = logoRef.current;
    if (!node || baseDisplayW <= 0 || baseDisplayH <= 0) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotation = Math.round((node.rotation() % 360 + 360) % 360);

    const newW = Math.abs(node.width() * scaleX);
    const newH = Math.abs(node.height() * scaleY);

    const relW = newW / baseDisplayW;
    const relH = newH / baseDisplayH;

    const newCenterX = node.x();
    const newCenterY = node.y();
    const relX = (newCenterX - baseOffsetX) / baseDisplayW;
    const relY = (newCenterY - baseOffsetY) / baseDisplayH;

    // Reset node scale so Konva doesn't accumulate scaling factors
    node.scaleX(logoTransform.flipX ? -1 : 1);
    node.scaleY(logoTransform.flipY ? -1 : 1);

    updateLogoTransform(
      {
        x: relX,
        y: relY,
        width: relW,
        height: relH,
        rotation,
      },
      true
    );
  };

  return (
    <main
      ref={containerRef}
      className="flex-1 relative bg-slate-200/80 overflow-hidden flex items-center justify-center select-none"
    >
      {/* Background checkerboard pattern for transparent canvas preview */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(#94a3b8 1px, transparent 1px), radial-gradient(#94a3b8 1px, #f1f5f9 1px)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 10px 10px',
        }}
      />

      {/* Smart AI Enhancement Notification Banner */}
      {activeImage && activeImage.suggestEnhance && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-3 px-4 py-2 bg-slate-900/90 backdrop-blur text-white text-xs rounded-xl shadow-xl border border-emerald-500/50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Gợi ý AI:</span>
          </div>
          <span className="text-slate-200 text-[11px]">
            Ảnh có độ phân giải thấp ({activeImage.originalWidth} × {activeImage.originalHeight} px). Bạn có muốn AI tự động tăng nét không?
          </span>
          <button
            onClick={() => enhanceImageAction(activeImage.id)}
            className="flex items-center space-x-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition active:scale-95 cursor-pointer shadow-xs text-[11px]"
          >
            <Sparkles className="w-3 h-3" />
            <span>Tăng Nét Bằng AI</span>
          </button>
          <button
            onClick={() => dismissEnhanceSuggestion(activeImage.id)}
            className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
            title="Bỏ qua"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* AI Processing Overlay */}
      {activeImage && activeImage.status === 'processing' && (
        <div className="absolute inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex flex-col items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
          <p className="text-xs font-bold text-white tracking-wide">
            Đang chạy AI siêu phân giải &amp; tăng độ nét...
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            Khử nhiễu và tối ưu nhãn thuốc thú y
          </p>
        </div>
      )}

      {/* Konva Stage */}
      {activeImage && baseHtmlImage ? (
        <Stage
          ref={stageRef}
          width={containerSize.width}
          height={containerSize.height}
          pixelRatio={typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 1}
          className="cursor-default"
        >
          {/* Base Product Layer */}
          <Layer>
            <KonvaImage
              image={baseHtmlImage}
              x={baseOffsetX}
              y={baseOffsetY}
              width={baseDisplayW}
              height={baseDisplayH}
              shadowColor="black"
              shadowBlur={20}
              shadowOpacity={0.15}
              shadowOffsetX={0}
              shadowOffsetY={8}
            />
          </Layer>

          {/* Logo Layer */}
          {logoHtmlImage && (
            <Layer>
              <KonvaImage
                ref={logoRef}
                image={logoHtmlImage}
                x={logoCenterPixelX}
                y={logoCenterPixelY}
                width={logoPixelW}
                height={logoPixelH}
                offsetX={logoPixelW / 2}
                offsetY={logoPixelH / 2}
                rotation={logoTransform.rotation}
                opacity={logoTransform.opacity}
                scaleX={logoTransform.flipX ? -1 : 1}
                scaleY={logoTransform.flipY ? -1 : 1}
                draggable
                onDragEnd={handleDragEnd}
                onTransformEnd={handleTransformEnd}
              />
              <Transformer
                ref={trRef}
                keepRatio={logoTransform.keepAspectRatio}
                enabledAnchors={[
                  'top-left',
                  'top-right',
                  'bottom-left',
                  'bottom-right',
                  'middle-left',
                  'middle-right',
                  'top-center',
                  'bottom-center',
                ]}
                boundBoxFunc={(oldBox, newBox) => {
                  // Minimum size limit: 15px
                  if (Math.abs(newBox.width) < 15 || Math.abs(newBox.height) < 15) {
                    return oldBox;
                  }
                  return newBox;
                }}
                anchorCornerRadius={3}
                anchorSize={8}
                anchorFill="#10B981"
                anchorStroke="#FFFFFF"
                anchorStrokeWidth={1.5}
                borderStroke="#10B981"
                borderStrokeWidth={1.5}
                borderDash={[4, 4]}
              />
            </Layer>
          )}
        </Stage>
      ) : (
        /* Empty State */
        <div className="z-10 text-center p-8 max-w-md bg-white/90 backdrop-blur rounded-2xl shadow-sm border border-slate-200">
          <img
            src="/assets/brand/phuong_nam_logo.png"
            alt="Logo"
            className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-emerald-500 shadow-sm object-contain"
          />
          <h3 className="text-base font-bold text-slate-800 mb-1">
            Chào mừng đến với Phương Nam Product Studio
          </h3>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            Chọn một hoặc nhiều ảnh sản phẩm ở cột bên trái để bắt đầu gắn logo và xuất ảnh độ phân giải gốc.
          </p>
          <button
            onClick={() => pickImages()}
            className="px-5 py-2.5 bg-brand-navy hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow transition active:scale-95 cursor-pointer"
          >
            Bắt Đầu Ngay (Chọn Ảnh Sản Phẩm)
          </button>
        </div>
      )}

      {/* Floating Canvas Toolbar Controls (Bottom Center) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-1 px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-slate-200/80 text-slate-700 select-none">
        <button
          onClick={() => setZoom(zoom - 0.1)}
          title="Thu nhỏ"
          className="p-1 rounded-full hover:bg-slate-100 transition"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <span className="text-[11px] font-mono font-medium px-2 text-slate-600 min-w-11 text-center">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={() => setZoom(zoom + 0.1)}
          title="Phóng to"
          className="p-1 rounded-full hover:bg-slate-100 transition"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="h-3.5 w-px bg-slate-200 mx-1" />

        <button
          onClick={() => setZoom(1.0)}
          title="Vừa màn hình (Fit)"
          className="flex items-center space-x-1 px-2 py-0.5 rounded-full hover:bg-slate-100 text-[11px] font-medium transition"
        >
          <Maximize2 className="w-3 h-3" />
          <span>Vừa khung</span>
        </button>

        <button
          onClick={() => useEditorStore.getState().resetLogoTransform()}
          title="Đặt lại vị trí Logo"
          className="flex items-center space-x-1 px-2 py-0.5 rounded-full hover:bg-slate-100 text-[11px] font-medium text-slate-600 transition"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Logo</span>
        </button>
      </div>
    </main>
  );
};
