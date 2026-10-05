# Phương Nam Product Studio

> **Ứng dụng Desktop chuyên nghiệp gắn logo & watermark thương hiệu cho shop "Thuốc Thú Y - Phương Nam"**  
> Hỗ trợ xử lý ảnh đơn lẻ và hàng loạt (Batch Processing) bảo toàn 100% độ phân giải gốc của ảnh sản phẩm.

---

## 🌟 Tính Năng Nổi Bật

1. **Bảo tồn Độ Phân Giải Gốc (Full-Resolution Preservation)**:
   - Ảnh sản phẩm gốc kích thước lớn (ví dụ: `4000 × 3000 px`, `6000 × 4000 px`) được giữ nguyên tuyệt đối khi xuất.
   - Không dùng chụp màn hình canvas preview; áp dụng thuật toán ánh xạ tọa độ chuẩn hóa và render trực tiếp bằng engine Sharp.

2. **Giao Diện Trực Quan & Thẩm Mỹ Cao (Tiếng Việt)**:
   - Thiết kế chuẩn Desktop chuyên nghiệp mang nhận diện thương hiệu Phương Nam (Xanh Navy `#0F2C59`, Xanh Ngọc `#10B981`, Trắng, Xám nhạt).
   - Canvas tương tác Konva với tính năng Kéo (Drag), Phóng to/Thu nhỏ (Resize) giữ tỉ lệ, Xoay (Rotate), Lật ngang/dọc (Flip), Điều chỉnh độ trong suốt (Opacity).

3. **Vị Trí Nhanh 9 Điểm (3x3 Grid)**:
   - 9 nút neo thông minh: *Trên Trái, Trên Giữa, Trên Phải, Giữa Trái, Chính Giữa, Giữa Phải, Dưới Trái, Dưới Giữa, Dưới Phải*.

4. **Xử Lý Hàng Loạt (Batch Processing 100+ ảnh)**:
   - Áp dụng cấu hình logo hiện tại cho hàng loạt ảnh cùng lúc.
   - Giới hạn luồng đồng thời (Concurrency Control = 3 workers) tối ưu bộ nhớ RAM, chống đơ/treo máy.
   - Thanh tiến trình trực quan, báo cáo trạng thái từng file (Thành công / Thất bại có nguyên nhân) và nút Hủy tức thì.

5. **Hệ Thống Mẫu Cấu Hình (Presets)**:
   - Cài sẵn các preset: *Facebook Feed, Zalo / Báo giá chống trộm, Sàn TMĐT*.
   - Cho phép người dùng lưu cấu hình hiện tại thành Preset mới và quản lý dễ dàng.

6. **Lưu & Mở Dự Án (.phuongnamproject)**:
   - Lưu trạng thái làm việc gọn nhẹ dưới định dạng JSON, không nhúng ảnh thô.
   - Cảnh báo tiếng Việt rõ ràng nếu có file ảnh bị di chuyển hoặc mất.

7. **Bảo Mật & Offline Tuyệt Đối**:
   - Chạy 100% local trên máy tính, không cần tài khoản, không cần internet, không truyền dữ liệu ra ngoài.
   - Không bao giờ sửa đổi hay ghi đè lên ảnh gốc của người dùng.

---

## 🚀 Hướng Dẫn Cài Đặt & Phát Triển

### Yêu cầu hệ thống:
- Node.js >= 18.0.0
- npm >= 9.0.0

### 1. Cài đặt thư viện
```bash
npm install
```

### 2. Khởi chạy chế độ phát triển (Dev)
```bash
npm run dev
```

### 3. Chạy kiểm thử tự động (Automated Tests)
```bash
npm test
```

### 4. Build ứng dụng
- **macOS**:
  ```bash
  npm run package:mac
  ```
  File `.dmg` và `.app` sẽ nằm trong thư mục `release/`.

- **Windows**:
  ```bash
  npm run package:win
  ```
  Bộ cài NSIS `.exe` sẽ được đóng gói trong thư mục `release/`.

---

## ⌨️ Phím Tắt Tiện Lợi
- `Cmd / Ctrl + O`: Mở ảnh sản phẩm
- `Cmd / Ctrl + S`: Lưu dự án
- `Cmd / Ctrl + E`: Xuất nhanh ảnh đang chọn
- `Cmd / Ctrl + Z`: Hoàn tác (Undo)
- `Cmd / Ctrl + Shift + Z`: Làm lại (Redo)
- `Delete / Backspace`: Đặt lại vị trí Logo về mặc định
