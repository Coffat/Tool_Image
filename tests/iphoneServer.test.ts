import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { IphoneServer } from '../src/main/services/iphoneServer';
import fs from 'fs';
import path from 'path';

// Mock electron app and BrowserWindow
vi.mock('electron', () => {
  return {
    app: {
      getPath: (name: string) => path.join(process.cwd(), 'scratch', 'test_' + name),
    },
    BrowserWindow: vi.fn(),
    shell: {
      openPath: vi.fn(),
    },
  };
});

describe('IphoneServer Unit Tests', () => {
  const server = IphoneServer.getInstance();

  it('1. Đảm bảo thư mục lưu trữ ảnh được tạo chính xác', () => {
    const folder = server.getSavedFolder();
    expect(fs.existsSync(folder)).toBe(true);
    expect(folder).toContain('iPhone_Uploads');
  });

  it('2. Khởi động server nội bộ và sinh mã QR hợp lệ', async () => {
    const mockWindow = {
      isDestroyed: () => false,
      webContents: {
        send: vi.fn(),
      },
    } as any;

    const status = await server.start(mockWindow);
    expect(status.isRunning).toBe(true);
    expect(status.port).toBeGreaterThan(0);
    expect(status.url).toContain(`:${status.port}`);
    expect(status.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('3. Lấy trạng thái server chính xác', () => {
    const status = server.getStatus();
    expect(status.isRunning).toBe(true);
    expect(typeof status.receivedCount).toBe('number');
  });

  it('4. Dừng server sạch sẽ', async () => {
    await server.stop();
    const status = server.getStatus();
    expect(status.isRunning).toBe(false);
  });
});
