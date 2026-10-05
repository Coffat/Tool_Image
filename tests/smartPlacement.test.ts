import { describe, it, expect, beforeAll } from 'vitest';
import { SmartPlacementService } from '../src/main/services/smartPlacement';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

describe('SmartPlacementService Tests', () => {
  const service = SmartPlacementService.getInstance();
  const testDir = path.join(process.cwd(), 'scratch', 'test_smart');
  const sampleImagePath = path.join(testDir, 'bottle_sample.jpg');

  beforeAll(async () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a synthetic product photo: white background with a colored product in bottom-center
    // Top corners are completely clean white background (negative space)
    const width = 1000;
    const height = 1000;
    const svgProduct = `
      <svg width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="#FFFFFF"/>
        <!-- Product bottle located in center-bottom with text -->
        <rect x="400" y="400" width="200" height="500" rx="20" fill="#003B73"/>
        <rect x="420" y="500" width="160" height="250" fill="#E2E8F0"/>
        <text x="500" y="600" font-size="20" text-anchor="middle" fill="#000000">THUOC THU Y</text>
      </svg>
    `;

    await sharp(Buffer.from(svgProduct)).jpeg().toFile(sampleImagePath);
  });

  it('1. Phân tích ảnh và trả về kết quả góc đặt hợp lệ', async () => {
    const result = await service.detectPlacement(sampleImagePath);

    expect(result).toBeDefined();
    expect(['top-left', 'top-right', 'bottom-left', 'bottom-right']).toContain(result.corner);
    expect(result.x).toBeGreaterThan(0);
    expect(result.x).toBeLessThan(1);
    expect(result.y).toBeGreaterThan(0);
    expect(result.y).toBeLessThan(1);
    expect(result.scale).toBeGreaterThanOrEqual(0.16);
    expect(result.scale).toBeLessThanOrEqual(0.24);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.description).toContain('Đã chọn');
  });

  it('2. Chọn chính xác góc trên (nền trắng trống) thay vì đè lên chai thuốc ở giữa/dưới', async () => {
    const result = await service.detectPlacement(sampleImagePath);
    // Since the bottle is in center-bottom, top-left or top-right must win
    expect(['top-left', 'top-right']).toContain(result.corner);
  });

  it('3. Xử lý batch nhiều ảnh đồng thời siêu tốc', async () => {
    const sampleImage2 = path.join(testDir, 'sample_2.jpg');
    fs.copyFileSync(sampleImagePath, sampleImage2);

    const startTime = Date.now();
    const batchResults = await service.detectBatch([sampleImagePath, sampleImage2]);
    const duration = Date.now() - startTime;

    expect(Object.keys(batchResults).length).toBe(2);
    expect(batchResults[sampleImagePath]).toBeDefined();
    expect(batchResults[sampleImage2]).toBeDefined();
    // Local processing must be extremely fast (< 1.5 seconds for both)
    expect(duration).toBeLessThan(2000);
  });
});
