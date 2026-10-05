import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ExportOptions } from '../../shared/types';

export interface ProcessImageParams {
  imagePath: string;
  logoPath: string;
  transform: {
    // Relative coordinates (0.0 to 1.0) based on product image dimensions
    relCenterX: number;
    relCenterY: number;
    relWidth: number;
    relHeight: number;
    rotation: number;     // 0 to 360 degrees
    opacity: number;      // 0.0 to 1.0
    flipX: boolean;
    flipY: boolean;
  };
  exportOptions: ExportOptions;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

export class ImageProcessor {
  /**
   * Reads metadata of any supported image file
   */
  public static async getMetadata(imagePath: string): Promise<ImageMetadata> {
    const stat = await fs.promises.stat(imagePath);
    const meta = await sharp(imagePath).metadata();
    return {
      width: meta.width || 0,
      height: meta.height || 0,
      format: meta.format || '',
      size: stat.size,
    };
  }

  /**
   * Generates a unique output file path to avoid overwriting original or existing files
   */
  public static generateUniqueOutputPath(
    originalPath: string,
    outputFolder: string,
    suffix: string,
    format: 'jpeg' | 'png' | 'webp'
  ): string {
    const extMap: Record<string, string> = {
      jpeg: '.jpg',
      png: '.png',
      webp: '.webp',
    };

    const targetFolder = outputFolder && outputFolder.trim() !== ''
      ? outputFolder
      : path.dirname(originalPath);

    const baseName = path.basename(originalPath, path.extname(originalPath));
    const ext = extMap[format] || '.jpg';
    let candidateName = `${baseName}${suffix}${ext}`;
    let candidatePath = path.join(targetFolder, candidateName);

    // If destination already exists, append _1, _2, etc.
    let counter = 1;
    while (fs.existsSync(candidatePath)) {
      candidateName = `${baseName}${suffix}_${counter}${ext}`;
      candidatePath = path.join(targetFolder, candidateName);
      counter++;
    }

    return candidatePath;
  }

  /**
   * Composites logo on the original full-resolution image and saves to disk
   */
  public static async processAndExport(params: ProcessImageParams): Promise<{
    outputPath: string;
    width: number;
    height: number;
    fileSize: number;
  }> {
    const { imagePath, logoPath, transform, exportOptions } = params;

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Ảnh sản phẩm không tồn tại: ${imagePath}`);
    }
    if (!fs.existsSync(logoPath)) {
      throw new Error(`Logo không tồn tại: ${logoPath}`);
    }

    // 1. Read base image metadata (Full Resolution)
    const baseMeta = await sharp(imagePath).metadata();
    const origW = baseMeta.width;
    const origH = baseMeta.height;

    if (!origW || !origH) {
      throw new Error('Không thể đọc kích thước ảnh gốc.');
    }

    // 2. Calculate absolute dimensions and center in original coordinate space
    const targetW = Math.max(1, Math.round(transform.relWidth * origW));
    const targetH = Math.max(1, Math.round(transform.relHeight * origH));
    const origCenterX = Math.round(transform.relCenterX * origW);
    const origCenterY = Math.round(transform.relCenterY * origH);

    // Resize with high-order Lanczos3 + edge sharpening for razor-sharp logo details
    let logoPipeline = sharp(logoPath)
      .ensureAlpha()
      .resize(targetW, targetH, {
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
        fastShrinkOnLoad: false,
      })
      .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.5 });

    if (transform.flipX) {
      logoPipeline = logoPipeline.flop();
    }
    if (transform.flipY) {
      logoPipeline = logoPipeline.flip();
    }

    if (transform.rotation !== 0) {
      logoPipeline = logoPipeline.rotate(transform.rotation, {
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }

    let processedLogoBuffer = await logoPipeline.toBuffer();
    const rotatedLogoMeta = await sharp(processedLogoBuffer).metadata();
    const rotatedW = rotatedLogoMeta.width || targetW;
    const rotatedH = rotatedLogoMeta.height || targetH;

    // 4. Adjust Opacity if less than 1.0
    const clampedOpacity = Math.max(0, Math.min(1, transform.opacity));
    if (clampedOpacity < 0.999) {
      const { data, info } = await sharp(processedLogoBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Multiply alpha channel (index 3 in RGBA) by opacity
      for (let i = 3; i < data.length; i += 4) {
        data[i] = Math.round(data[i] * clampedOpacity);
      }

      processedLogoBuffer = await sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4,
        },
      })
        .png()
        .toBuffer();
    }

    // 5. Calculate Top-Left position in Base Image
    let left = Math.round(origCenterX - rotatedW / 2);
    let top = Math.round(origCenterY - rotatedH / 2);

    // Handle edge case where logo extends outside the base image boundary
    let overlayBuffer = processedLogoBuffer;
    let overlayW = rotatedW;
    let overlayH = rotatedH;

    let extractLeft = 0;
    let extractTop = 0;
    let extractWidth = rotatedW;
    let extractHeight = rotatedH;

    if (left < 0) {
      extractLeft = -left;
      extractWidth += left;
      left = 0;
    }
    if (top < 0) {
      extractTop = -top;
      extractHeight += top;
      top = 0;
    }
    if (left + extractWidth > origW) {
      extractWidth = origW - left;
    }
    if (top + extractHeight > origH) {
      extractHeight = origH - top;
    }

    // If logo was clipped by boundary, extract visible slice
    if (
      extractLeft > 0 ||
      extractTop > 0 ||
      extractWidth < overlayW ||
      extractHeight < overlayH
    ) {
      if (extractWidth > 0 && extractHeight > 0) {
        overlayBuffer = await sharp(overlayBuffer)
          .extract({
            left: extractLeft,
            top: extractTop,
            width: extractWidth,
            height: extractHeight,
          })
          .toBuffer();
      } else {
        // Entirely off-screen, dummy 1x1 transparent
        overlayBuffer = await sharp({
          create: {
            width: 1,
            height: 1,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
          .png()
          .toBuffer();
        left = 0;
        top = 0;
      }
    }

    // 6. Composite onto original image
    let compositePipeline = sharp(imagePath).composite([
      {
        input: overlayBuffer,
        top: Math.max(0, top),
        left: Math.max(0, left),
      },
    ]);

    // 7. Configure output format & quality
    const format = exportOptions.format || 'jpeg';
    const quality = Math.max(10, Math.min(100, exportOptions.quality || 92));

    if (format === 'jpeg') {
      compositePipeline = compositePipeline.jpeg({ quality, mozjpeg: true });
    } else if (format === 'png') {
      compositePipeline = compositePipeline.png({ compressionLevel: 8 });
    } else if (format === 'webp') {
      compositePipeline = compositePipeline.webp({ quality });
    }

    // 8. Generate safe output file path
    const outputPath = this.generateUniqueOutputPath(
      imagePath,
      exportOptions.outputFolder,
      exportOptions.filenameSuffix || '-branded',
      format
    );

    // Ensure output directory exists
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      await fs.promises.mkdir(outDir, { recursive: true });
    }

    await compositePipeline.toFile(outputPath);
    const finalStat = await fs.promises.stat(outputPath);

    return {
      outputPath,
      width: origW,
      height: origH,
      fileSize: finalStat.size,
    };
  }
}
