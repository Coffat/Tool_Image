import sharp from 'sharp';
import fs from 'fs';
import { SmartPlacementResult } from '../../shared/types';

interface CornerStats {
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  cornerLabel: string;
  edgeEnergy: number;
  variance: number;
  extensionClutter: number;
  score: number;
}

export class SmartPlacementService {
  private static instance: SmartPlacementService | null = null;

  public static getInstance(): SmartPlacementService {
    if (!SmartPlacementService.instance) {
      SmartPlacementService.instance = new SmartPlacementService();
    }
    return SmartPlacementService.instance;
  }

  /**
   * Fast local Computer Vision layout analysis to find the optimal empty negative space for watermarking
   */
  public async detectPlacement(imagePath: string): Promise<SmartPlacementResult> {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`File không tồn tại: ${imagePath}`);
    }

    const ANALYSIS_SIZE = 200;

    // Load and downsample to 200x200 greyscale for sub-millisecond local processing
    const { data } = await sharp(imagePath)
      .rotate() // auto EXIF orientation
      .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const getPixel = (x: number, y: number): number => {
      const cx = Math.max(0, Math.min(ANALYSIS_SIZE - 1, x));
      const cy = Math.max(0, Math.min(ANALYSIS_SIZE - 1, y));
      return data[cy * ANALYSIS_SIZE + cx];
    };

    // Calculate Sobel gradient magnitude at (x, y)
    const getGradient = (x: number, y: number): number => {
      const gx = Math.abs(getPixel(x + 1, y) - getPixel(x - 1, y));
      const gy = Math.abs(getPixel(x, y + 1) - getPixel(x, y - 1));
      return gx + gy;
    };

    const analyzeZone = (
      startX: number,
      endX: number,
      startY: number,
      endY: number,
      extStartX: number,
      extEndX: number,
      extStartY: number,
      extEndY: number,
      corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
      cornerLabel: string
    ): CornerStats => {
      let totalGrad = 0;
      let sum = 0;
      let sumSq = 0;
      let count = 0;

      for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
          const val = getPixel(x, y);
          const grad = getGradient(x, y);
          totalGrad += grad;
          sum += val;
          sumSq += val * val;
          count++;
        }
      }

      const mean = sum / count;
      const variance = Math.max(0, sumSq / count - mean * mean);
      const edgeEnergy = totalGrad / count;

      // Check extension zone closer to center to evaluate negative space capacity
      let extTotalGrad = 0;
      let extCount = 0;
      for (let y = extStartY; y < extEndY; y += 2) {
        for (let x = extStartX; x < extEndX; x += 2) {
          extTotalGrad += getGradient(x, y);
          extCount++;
        }
      }
      const extensionClutter = extCount > 0 ? extTotalGrad / extCount : edgeEnergy;

      // Combined score: lower score = cleaner, flatter, emptier background
      // Edge energy is heavily weighted to strictly avoid product labels/text
      const score = edgeEnergy * 2.0 + Math.sqrt(variance) * 0.8;

      return {
        corner,
        cornerLabel,
        edgeEnergy,
        variance,
        extensionClutter,
        score,
      };
    };

    // Define 4 candidate corner zones (70x70 px in 200x200 space)
    const CORNER_SIZE = 70;
    const EXTENSION_SIZE = 100;

    const corners: CornerStats[] = [
      // 1. Top-Left
      analyzeZone(
        4,
        CORNER_SIZE,
        4,
        CORNER_SIZE,
        CORNER_SIZE,
        EXTENSION_SIZE,
        CORNER_SIZE,
        EXTENSION_SIZE,
        'top-left',
        'Góc trên - trái'
      ),
      // 2. Top-Right
      analyzeZone(
        ANALYSIS_SIZE - CORNER_SIZE,
        ANALYSIS_SIZE - 4,
        4,
        CORNER_SIZE,
        ANALYSIS_SIZE - EXTENSION_SIZE,
        ANALYSIS_SIZE - CORNER_SIZE,
        CORNER_SIZE,
        EXTENSION_SIZE,
        'top-right',
        'Góc trên - phải'
      ),
      // 3. Bottom-Left
      analyzeZone(
        4,
        CORNER_SIZE,
        ANALYSIS_SIZE - CORNER_SIZE,
        ANALYSIS_SIZE - 4,
        CORNER_SIZE,
        EXTENSION_SIZE,
        ANALYSIS_SIZE - EXTENSION_SIZE,
        ANALYSIS_SIZE - CORNER_SIZE,
        'bottom-left',
        'Góc dưới - trái'
      ),
      // 4. Bottom-Right
      analyzeZone(
        ANALYSIS_SIZE - CORNER_SIZE,
        ANALYSIS_SIZE - 4,
        ANALYSIS_SIZE - CORNER_SIZE,
        ANALYSIS_SIZE - 4,
        ANALYSIS_SIZE - EXTENSION_SIZE,
        ANALYSIS_SIZE - CORNER_SIZE,
        ANALYSIS_SIZE - EXTENSION_SIZE,
        ANALYSIS_SIZE - CORNER_SIZE,
        'bottom-right',
        'Góc dưới - phải'
      ),
    ];

    // Sort by lowest score (emptiest negative space)
    corners.sort((a, b) => a.score - b.score);
    const best = corners[0];

    // Adaptive scale:
    // Wide space (low extension clutter) -> 22%
    // Moderate space -> 20%
    // Narrow space (approaching bottle/product edges) -> 17%
    let scale = 0.20;
    if (best.extensionClutter < 14) {
      scale = 0.22;
    } else if (best.extensionClutter > 30) {
      scale = 0.17;
    }

    const padding = 0.035; // 3.5% margin from edge
    let x = 0.5;
    let y = 0.5;

    switch (best.corner) {
      case 'top-left':
        x = padding + scale / 2;
        y = padding + scale / 2;
        break;
      case 'top-right':
        x = 1.0 - padding - scale / 2;
        y = padding + scale / 2;
        break;
      case 'bottom-left':
        x = padding + scale / 2;
        y = 1.0 - padding - scale / 2;
        break;
      case 'bottom-right':
        x = 1.0 - padding - scale / 2;
        y = 1.0 - padding - scale / 2;
        break;
    }

    // Round for clean numbers
    x = Math.round(x * 1000) / 1000;
    y = Math.round(y * 1000) / 1000;

    const confidence = Math.max(0.6, Math.min(0.99, 1 - best.score / 150));

    return {
      corner: best.corner,
      cornerLabel: best.cornerLabel,
      x,
      y,
      scale,
      confidence: Math.round(confidence * 100) / 100,
      description: `Đã chọn ${best.cornerLabel} (Khoảng trống rộng, tỉ lệ ${Math.round(scale * 100)}%)`,
    };
  }

  /**
   * Batch analysis for multiple images in parallel
   */
  public async detectBatch(
    imagePaths: string[]
  ): Promise<Record<string, SmartPlacementResult>> {
    const results: Record<string, SmartPlacementResult> = {};
    const concurrency = 4;

    for (let i = 0; i < imagePaths.length; i += concurrency) {
      const chunk = imagePaths.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (filePath) => {
          try {
            results[filePath] = await this.detectPlacement(filePath);
          } catch (err) {
            console.error(`Error detecting smart placement for ${filePath}:`, err);
            // Fallback default
            results[filePath] = {
              corner: 'top-right',
              cornerLabel: 'Góc trên - phải',
              x: 0.85,
              y: 0.15,
              scale: 0.20,
              confidence: 0.5,
              description: 'Vị trí mặc định',
            };
          }
        })
      );
    }

    return results;
  }
}
