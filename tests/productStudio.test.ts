import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { ImageProcessor } from '../src/main/services/imageProcessor';
import { BatchQueue } from '../src/main/services/batchQueue';
import { ProjectService } from '../src/main/services/projectService';
import { PresetService } from '../src/main/services/presetService';
import { Preset, ProjectData } from '../src/shared/types';

describe('Phương Nam Product Studio - Image Processing Engine Tests', () => {
  const testDir = path.join(process.cwd(), 'tests/temp_test_output');
  const base4000x3000 = path.join(testDir, 'test_base_4000x3000.jpg');
  const testLogoPath = path.join(process.cwd(), 'assets/brand/phuong_nam_logo.png');

  beforeAll(async () => {
    if (!fs.existsSync(testDir)) {
      await fs.promises.mkdir(testDir, { recursive: true });
    }

    // Generate a true 4000 x 3000 high-resolution test image
    await sharp({
      create: {
        width: 4000,
        height: 3000,
        channels: 3,
        background: { r: 240, g: 243, b: 246 },
      },
    })
      .jpeg({ quality: 90 })
      .toFile(base4000x3000);
  });

  afterAll(async () => {
    // Cleanup temporary test outputs
    if (fs.existsSync(testDir)) {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    }
  });

  // Test 1: Image Import & Metadata
  it('1. Đọc đúng metadata ảnh gốc (4000 x 3000 px, format jpeg)', async () => {
    const meta = await ImageProcessor.getMetadata(base4000x3000);
    expect(meta.width).toBe(4000);
    expect(meta.height).toBe(3000);
    expect(meta.format).toBe('jpeg');
    expect(meta.size).toBeGreaterThan(0);
  });

  // Test 2: CRITICAL REQUIREMENT - Preserving exact 4000x3000 resolution
  it('2. [QUAN TRỌNG NHẤT] Ảnh gốc 4000x3000 -> Xuất ra bắt buộc phải đúng 4000x3000', async () => {
    const res = await ImageProcessor.processAndExport({
      imagePath: base4000x3000,
      logoPath: testLogoPath,
      transform: {
        relCenterX: 0.85,
        relCenterY: 0.85,
        relWidth: 0.18,
        relHeight: 0.18,
        rotation: 0,
        opacity: 0.9,
        flipX: false,
        flipY: false,
      },
      exportOptions: {
        format: 'jpeg',
        quality: 92,
        outputFolder: testDir,
        filenameSuffix: '-fullres-test',
        overwriteMode: 'rename',
      },
    });

    expect(res.width).toBe(4000);
    expect(res.height).toBe(3000);
    expect(fs.existsSync(res.outputPath)).toBe(true);

    // Verify exported file on disk
    const diskMeta = await sharp(res.outputPath).metadata();
    expect(diskMeta.width).toBe(4000);
    expect(diskMeta.height).toBe(3000);
  });

  // Test 3: Export PNG
  it('3. Xuất đúng định dạng PNG', async () => {
    const res = await ImageProcessor.processAndExport({
      imagePath: base4000x3000,
      logoPath: testLogoPath,
      transform: {
        relCenterX: 0.5,
        relCenterY: 0.5,
        relWidth: 0.2,
        relHeight: 0.2,
        rotation: 0,
        opacity: 1.0,
        flipX: false,
        flipY: false,
      },
      exportOptions: {
        format: 'png',
        quality: 100,
        outputFolder: testDir,
        filenameSuffix: '-test-png',
        overwriteMode: 'rename',
      },
    });

    const meta = await sharp(res.outputPath).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(4000);
    expect(meta.height).toBe(3000);
  });

  // Test 4: Export WebP
  it('4. Xuất đúng định dạng WebP', async () => {
    const res = await ImageProcessor.processAndExport({
      imagePath: base4000x3000,
      logoPath: testLogoPath,
      transform: {
        relCenterX: 0.2,
        relCenterY: 0.2,
        relWidth: 0.15,
        relHeight: 0.15,
        rotation: 0,
        opacity: 0.8,
        flipX: false,
        flipY: false,
      },
      exportOptions: {
        format: 'webp',
        quality: 85,
        outputFolder: testDir,
        filenameSuffix: '-test-webp',
        overwriteMode: 'rename',
      },
    });

    const meta = await sharp(res.outputPath).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(4000);
    expect(meta.height).toBe(3000);
  });

  // Test 5: Logo Rotation & Opacity & Flip
  it('5. Logo xoay 45 độ, opacity 50%, flip ngang dọc thành công', async () => {
    const res = await ImageProcessor.processAndExport({
      imagePath: base4000x3000,
      logoPath: testLogoPath,
      transform: {
        relCenterX: 0.5,
        relCenterY: 0.5,
        relWidth: 0.25,
        relHeight: 0.25,
        rotation: 45,
        opacity: 0.5,
        flipX: true,
        flipY: true,
      },
      exportOptions: {
        format: 'jpeg',
        quality: 90,
        outputFolder: testDir,
        filenameSuffix: '-transform-test',
        overwriteMode: 'rename',
      },
    });

    expect(fs.existsSync(res.outputPath)).toBe(true);
  });

  // Test 6: Unique Filename Generation to Avoid Overwriting
  it('6. Sinh tên file an toàn không bao giờ ghi đè file gốc', () => {
    const path1 = ImageProcessor.generateUniqueOutputPath(
      '/path/to/product.jpg',
      testDir,
      '-branded',
      'jpeg'
    );
    expect(path1).toContain('product-branded.jpg');

    // Create a dummy file at path1
    fs.writeFileSync(path1, 'dummy');

    // Next invocation should produce _1
    const path2 = ImageProcessor.generateUniqueOutputPath(
      '/path/to/product.jpg',
      testDir,
      '-branded',
      'jpeg'
    );
    expect(path2).toContain('product-branded_1.jpg');
  });

  // Test 7: Batch Queue Processing
  it('7. Batch export với concurrency control', async () => {
    const batchQueue = new BatchQueue();
    const items = [
      {
        imagePath: base4000x3000,
        logoPath: testLogoPath,
        transform: {
          relCenterX: 0.5,
          relCenterY: 0.5,
          relWidth: 0.1,
          relHeight: 0.1,
          rotation: 0,
          opacity: 1.0,
          flipX: false,
          flipY: false,
        },
        exportOptions: {
          format: 'jpeg' as const,
          quality: 90,
          outputFolder: testDir,
          filenameSuffix: '-batch-1',
          overwriteMode: 'rename' as const,
        },
      },
      {
        imagePath: base4000x3000,
        logoPath: testLogoPath,
        transform: {
          relCenterX: 0.8,
          relCenterY: 0.8,
          relWidth: 0.15,
          relHeight: 0.15,
          rotation: 0,
          opacity: 0.9,
          flipX: false,
          flipY: false,
        },
        exportOptions: {
          format: 'jpeg' as const,
          quality: 90,
          outputFolder: testDir,
          filenameSuffix: '-batch-2',
          overwriteMode: 'rename' as const,
        },
      },
    ];

    let progressCount = 0;
    const summary = await batchQueue.run(items, (prog) => {
      progressCount++;
      expect(prog.total).toBe(2);
    });

    expect(summary.successCount).toBe(2);
    expect(summary.errorCount).toBe(0);
    expect(summary.isCancelled).toBe(false);
    expect(progressCount).toBeGreaterThan(0);
  });

  // Test 8: Project Save / Load
  it('8. Lưu và nạp Project (.phuongnamproject) an toàn', async () => {
    const projectPath = path.join(testDir, 'test_project.phuongnamproject');
    const projectData: ProjectData = {
      version: '1.0',
      createdDate: new Date().toISOString(),
      images: [{ filePath: base4000x3000 }],
      activeLogoTransform: {
        logoId: 'brand-logo-default',
        logoPath: testLogoPath,
        x: 0.8,
        y: 0.8,
        width: 0.2,
        height: 0.2,
        rotation: 0,
        opacity: 0.95,
        flipX: false,
        flipY: false,
        keepAspectRatio: true,
      },
      presets: [],
      exportOptions: {
        format: 'jpeg',
        quality: 92,
        outputFolder: testDir,
        filenameSuffix: '-branded',
        overwriteMode: 'rename',
      },
    };

    await ProjectService.saveProject(projectPath, projectData);
    expect(fs.existsSync(projectPath)).toBe(true);

    const loaded = await ProjectService.loadProject(projectPath);
    expect(loaded.data.version).toBe('1.0');
    expect(loaded.missingFiles.length).toBe(0);
    expect(loaded.data.images[0].filePath).toBe(base4000x3000);
  });

  // Test 9: Preset Serialization
  it('9. Lưu và lấy danh sách Presets', async () => {
    const testPreset: Preset = {
      id: 'test-custom-preset',
      name: 'Custom Test Preset',
      relativeScale: 0.25,
      anchorPosition: 'bottom-right',
      paddingPercent: 0.05,
      opacity: 0.85,
      rotation: 15,
      flipX: false,
      flipY: false,
      exportOptions: {
        format: 'jpeg',
        quality: 95,
        outputFolder: '',
        filenameSuffix: '-custom',
        overwriteMode: 'rename',
      },
    };

    const list = await PresetService.savePreset(testPreset);
    expect(list.some((p) => p.id === 'test-custom-preset')).toBe(true);

    const afterDelete = await PresetService.deletePreset('test-custom-preset');
    expect(afterDelete.some((p) => p.id === 'test-custom-preset')).toBe(false);
  });
});
