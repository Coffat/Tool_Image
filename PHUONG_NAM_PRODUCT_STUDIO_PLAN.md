# KẾ HOẠCH TRIỂN KHAI: PHƯƠNG NAM PRODUCT STUDIO

> **Dự án**: Phương Nam Product Studio  
> **Mục tiêu**: Ứng dụng Desktop đa nền tảng (macOS & Windows) gắn logo & watermark thương hiệu "Thuốc Thú Y - Phương Nam" lên ảnh sản phẩm đơn lẻ và hàng loạt với chất lượng gốc tuyệt đối (Full Resolution).  
> **Tech Stack cốt lõi**: Electron + React 18 + TypeScript + Vite + Tailwind CSS + Konva.js (Canvas Preview) + Sharp (Export Engine chạy trên Node Main Process) + electron-builder.

---

## I. TỔNG QUAN KIẾN TRÚC & NGUYÊN TẮC KỸ THUẬT

### 1. Phân tách Main & Renderer Process
```
┌────────────────────────────────────────────────────────┐
│                   Renderer Process                     │
│  (React, TypeScript, Tailwind CSS, Zustand, Konva.js)  │
│                                                        │
│  - App Shell: Titlebar, Toolbar, Sidebars, Canvas      │
│  - State: EditorStore (ảnh, logo, transform, history)  │
│  - Canvas Preview: Interactive Konva Transformer       │
│  - No direct Node.js access (nodeIntegration: false)   │
└──────────────────────────┬─────────────────────────────┘
                           │ IPC Bridge (contextBridge)
┌──────────────────────────▼─────────────────────────────┐
│                    Preload Script                      │
│  window.electronAPI: expose strictly typed IPC methods │
└──────────────────────────┬─────────────────────────────┘
                           │ Typed IPC Events
┌──────────────────────────▼─────────────────────────────┐
│                     Main Process                       │
│  (Electron, Node.js, Sharp, Native File System)        │
│                                                        │
│  - Native Dialogs: Open Images, Choose Output Folder   │
│  - Sharp Engine: Full-resolution image composite       │
│  - Coordinate Mapper: Preview Coords -> Original Image │
│  - Batch Processor: Worker queue with concurrency = 3  │
│  - Project/Preset Store: Local JSON I/O                │
└────────────────────────────────────────────────────────┘
```

### 2. Nguyên tắc "Bảo tồn độ phân giải gốc" (Full-Resolution Preservation)
- **Preview Canvas**: Hiển thị ảnh sản phẩm được fit vào kích thước hiển thị (`viewportWidth` × `viewportHeight`), tính toán tỉ lệ `scaleFactor = previewWidth / originalWidth`.
- **Export Pipeline**:
  1. Lấy kích thước ảnh gốc qua `sharp(imagePath).metadata()`.
  2. Map tọa độ logo `(x, y, width, height, rotation, flipX, flipY, opacity)` từ Preview Space sang Original Space:
     - $x_{orig} = x_{preview} / scaleFactor$
     - $y_{orig} = y_{preview} / scaleFactor$
     - $width_{orig} = width_{preview} / scaleFactor$
     - $height_{orig} = height_{preview} / scaleFactor$
  3. Dùng Sharp render logo với kích thước gốc đã resize, xoay (`rotate`), đổi độ mờ đục (`opacity`) và composite thẳng lên ảnh gốc.
  4. TUYỆT ĐỐI không chụp ảnh màn hình (canvas screenshot) để export.

---

## II. CẤU TRÚC THƯ MỤC DỰ ÁN

```
Tool_Image/
├── PHUONG_NAM_PRODUCT_STUDIO_PLAN.md
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── electron-builder.json
├── assets/
│   ├── icons/                  # App icon (macOS .icns, Windows .ico, Linux .png)
│   └── brand/                  # Logo Phương Nam mặc định (.png trong suốt, .svg)
├── src/
│   ├── main/
│   │   ├── index.ts            # Electron main lifecycle & window management
│   │   ├── preload.ts          # contextBridge safe IPC APIs
│   │   ├── ipc/
│   │   │   ├── imageIpc.ts     # Image open dialog, metadata extraction, thumbnails
│   │   │   ├── exportIpc.ts    # Single & Batch export handling
│   │   │   └── projectIpc.ts   # Project & Preset save/load file system handlers
│   │   └── services/
│   │       ├── imageProcessor.ts   # Sharp composite & coordinate transformation
│   │       ├── batchQueue.ts       # Concurrency limiter & progress emitter
│   │       └── presetService.ts    # Local preset management
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── styles/globals.css
│   │   ├── components/
│   │   │   ├── AppShell/       # Header, Statusbar, Layout Container
│   │   │   ├── Canvas/         # Konva Stage, ImageLayer, LogoLayer, Transformer
│   │   │   ├── ImagePanel/     # Left sidebar: File list, thumbnail, drag-drop
│   │   │   ├── LogoPanel/      # Right sidebar: Brand logos, quick 9-positions, transforms
│   │   │   ├── ExportPanel/    # Format, quality, output destination, export trigger
│   │   │   ├── BatchPanel/     # Batch export progress modal, cancel button
│   │   │   └── PresetPanel/    # Quick preset dropdown & manage modal
│   │   ├── stores/
│   │   │   ├── editorStore.ts  # Active image, logo transform, undo/redo history
│   │   │   ├── batchStore.ts   # Multi-image list, processing status, progress
│   │   │   └── presetStore.ts  # Loaded presets
│   │   └── types/              # Renderer-specific types
│   └── shared/
│       ├── types.ts            # Data models shared across Main and Renderer
│       └── constants.ts        # Default settings, brand colors, 9 anchor presets
└── tests/
    ├── imageProcessor.test.ts  # Test tọa độ, tỷ lệ, Sharp composite
    ├── batchQueue.test.ts      # Test concurrency, cancelation, error reporting
    └── preset.test.ts          # Test serialization / deserialization
```

---

## III. DATA MODELS & IPC INTERFACES

### Shared Types
- `ImageItem`: ID, đường dẫn gốc, tên file, kích thước thực (width, height), preview URL, trạng thái.
- `LogoTransform`: Tọa độ x, y, width, height, rotation (độ), opacity (0..1), flipX, flipY, keepAspectRatio.
- `NineAnchorPosition`: 9 vị trí neo chuẩn (top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right).
- `ExportOptions`: format ('jpeg' | 'png' | 'webp'), quality (1-100), outputFolder, filenameSuffix ('-branded'), overwriteMode ('skip' | 'rename' | 'overwrite').
- `Preset`: ID, tên preset, anchorPosition, relativeScale, paddingPercent, opacity, rotation, exportOptions.
- `ProjectData`: Danh sách file, trạng thái logo, preset, export options.

---

## IV. LỘ TRÌNH 10 GIAI ĐOẠN (PHASES)

### **PHASE 0: Khởi tạo Project & Thiết lập Nền tảng**
- Khởi tạo repo với Vite + React 18 + TypeScript + Tailwind CSS.
- Cài đặt Electron, electron-builder, concurrently, cross-env.
- Cài đặt Sharp, Konva, react-konva, zustand, lucide-react.
- Cấu hình TypeScript, Tailwind (màu sắc: Deep Navy `#0F2C59`, Emerald Green `#10B981`, White, Light Gray).
- Chuẩn bị Brand Assets mặc định (Logo Phương Nam trong suốt `assets/brand/phuong_nam_logo.png`).
- Thiết lập IPC an toàn (`contextIsolation: true`, `nodeIntegration: false`).
- Chạy thử `npm run dev` xác nhận cửa sổ Electron khởi động trơn tru.

### **PHASE 1: Thiết kế UI App Shell & Hệ thống Thiết kế**
- Cài đặt Titlebar tùy chỉnh chuẩn desktop với logo Phương Nam.
- Layout 3 cột:
  - Sidebar trái: Danh sách ảnh sản phẩm & Import zone.
  - Vùng giữa: Canvas tương tác với thanh Zoom / Fit / Reset.
  - Sidebar phải: Brand Logo, 9 Vị trí nhanh, Thuộc tính biến đổi & Cấu hình xuất.
- Toàn bộ giao diện chuẩn hóa Tiếng Việt, thẩm mỹ thanh lịch, cao cấp, tốc độ phản hồi tức thì.

### **PHASE 2: Import Ảnh Sản phẩm & Canvas Preview**
- Hỗ trợ Mở file qua Dialog & Kéo thả (Drag & Drop) nhiều file.
- Lọc định dạng hợp lệ: `.jpg`, `.jpeg`, `.png`, `.webp`.
- Hiển thị danh sách thumbnail, thông tin kích thước gốc (WxH), nút xóa từng ảnh.
- Konva Canvas tải ảnh sản phẩm nền, tự động căn giữa và fit tối ưu trong khung hình.
- Công cụ điều khiển: Zoom in, Zoom out, Fit View, 100% (Reset).

### **PHASE 3: Logo Layer & Tương tác Biến đổi (Konva Transformer)**
- Cài sẵn Logo Phương Nam mặc định trong hệ thống, hỗ trợ thêm logo mới ngoài máy.
- Layer Logo trên Canvas:
  - Di chuyển tự do (Drag).
  - Thay đổi kích thước (Resize) giữ nguyên tỷ lệ aspect ratio mặc định.
  - Xoay (Rotate) mượt mà với góc xoay hiển thị trực quan.
  - 9 nút chọn vị trí nhanh: Trên-Trái, Trên-Giữa, Trên-Phải, Giữa-Trái, Chính Giữa, Giữa-Phải, Dưới-Trái, Dưới-Giữa, Dưới-Phải.
  - Điều chỉnh độ trong suốt (Opacity slider: 0% - 100%).
  - Lật ảnh (Flip ngang / Flip dọc).
  - Đặt lại vị trí ban đầu (Reset).
- Hệ thống Undo / Redo lịch sử thao tác (`Ctrl/Cmd + Z`, `Ctrl/Cmd + Shift + Z`).

### **PHASE 4: Sharp Export Engine (Bảo toàn Full Resolution)**
- Xây dựng service `imageProcessor.ts` trong Main Process:
  - Nhận thông số biến đổi chuẩn hóa từ Renderer.
  - Tải ảnh gốc từ đĩa -> Đọc metadata thật.
  - Resize & xoay & điều chỉnh alpha của logo phù hợp với kích thước thật của ảnh gốc.
  - Dùng Sharp `.composite()` ép logo lên ảnh gốc.
  - Xuất ra định dạng yêu cầu (JPG quality tuỳ chỉnh, PNG lossless, WebP).
  - Kiểm tra nếu tên file trùng: tự động đánh số `_1`, `_2` an toàn không ghi đè ảnh gốc.
- Phím tắt `Ctrl/Cmd + E` xuất nhanh ảnh đang chọn.

### **PHASE 5: Xử lý Hàng loạt (Batch Processing)**
- Chọn hàng loạt 50 - 100+ ảnh sản phẩm.
- Chọn thư mục xuất bằng thư mục duyệt hệ thống.
- Xử lý qua hàng đợi `batchQueue.ts` với giới hạn luồng đồng thời (Concurrency limit = 3) chống nghẽn RAM và CPU.
- Modal Tiến trình trực quan: hiển thị "Đang xử lý X / N ảnh", thanh tiến trình (Progress bar), trạng thái từng file (Thành công / Thất bại + lý do cụ thể).
- Nút "Hủy xử lý" (Cancel) an toàn tức thì.

### **PHASE 6: Hệ thống Preset (Mẫu cấu hình sẵn)**
- Cung cấp các preset sẵn có:
  - "Facebook Feed" (Góc dưới phải, kích thước 18%, padding 3%).
  - "Zalo / Chợ sỉ" (Chính giữa làm mờ chống trộm ảnh, opacity 35%).
  - "Sàn TMĐT Shopee/Lazada" (Góc trên trái, kích thước 15%).
- Cho phép người dùng Lưu cấu hình hiện tại thành Preset mới, Sửa tên, Nhân bản, Xóa.
- Lưu trữ cục bộ an toàn trong thư mục dữ liệu ứng dụng (`app.getPath('userData')`).

### **PHASE 7: Lưu & Mở Dự án (.phuongnamproject)**
- Định dạng file cấu hình nhẹ dạng JSON lưu trạng thái phiên làm việc.
- Chỉ lưu đường dẫn ảnh, logo, tọa độ, export settings; không nhúng ảnh thô vào file.
- Xử lý thông minh khi đường dẫn ảnh gốc bị mất hoặc di chuyển (Cảnh báo Tiếng Việt rõ ràng, không crash).

### **PHASE 8: Tinh chỉnh UI/UX & Phím tắt Nâng cao**
- Hệ thống phím tắt hoàn chỉnh: `Cmd/Ctrl + O` (Mở ảnh), `Cmd/Ctrl + S` (Lưu project), `Delete/Backspace` (Xóa logo), `Cmd/Ctrl + E` (Xuất ảnh), `Cmd/Ctrl + Z / Shift + Z`.
- Toast notifications thông báo trạng thái thao tác đẹp mắt, thân thiện.
- Tối ưu hiển thị responsive đa màn hình từ `1280×800` đến `4K`.

### **PHASE 9: Kiểm thử Tự động (Automated Testing)**
- Viết bộ test Vitest:
  - Test chuyển đổi tọa độ từ Preview sang Kích thước gốc (Đảm bảo 4000x3000 ra đúng 4000x3000).
  - Test xuất file định dạng JPG, PNG, WebP với Sharp.
  - Test xử lý hàng loạt và cơ chế Cancel.
  - Test sinh tên file an toàn khi trùng lặp.
  - Test lưu và nạp cấu hình Preset / Project.

### **PHASE 10: Đóng gói & Build (Packaging macOS & Windows)**
- Cấu hình `electron-builder.json`:
  - macOS: Đóng gói `.dmg` và `.zip`.
  - Windows: Đóng gói bộ cài `.exe` (NSIS).
- Tạo icon ứng dụng chuyên nghiệp cho macOS (.icns) và Windows (.ico) từ logo Phương Nam.
- Thiết lập các script npm chuẩn:
  - `npm run dev`
  - `npm run build`
  - `npm run package:mac`
  - `npm run package:win`
  - `npm test`

---

## V. ĐỊNH NGHĨA HOÀN THÀNH (DEFINITION OF DONE)
1. Chạy được trơn tru trên macOS và Windows.
2. Mở ảnh đơn & nhiều ảnh, kéo thả mượt mà.
3. Logo Phương Nam có sẵn, hỗ trợ thêm logo ngoài.
4. Điều khiển tương tác logo đầy đủ: Kéo, Resize giữ tỉ lệ, Xoay, Opacity, Flip, 9 vị trí nhanh.
5. Undo / Redo lịch sử thao tác.
6. Export giữ nguyên độ phân giải ảnh gốc (100% verified).
7. Batch export 100+ ảnh có progress bar & concurrency control.
8. Quản lý Preset & Lưu/Mở Project `.phuongnamproject`.
9. Xử lý lỗi toàn diện bằng Tiếng Việt, không crash trong mọi tình huống.
10. Toàn bộ automated tests pass và TypeScript pass không lỗi.
