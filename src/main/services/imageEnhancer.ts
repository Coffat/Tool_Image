import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { app } from 'electron';
import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);

// Lazy-load onnxruntime-node to avoid startup cost
let ort: typeof import('onnxruntime-node') | null = null;
let cachedSession: any = null;

function getOrt() {
  if (!ort) {
    ort = nodeRequire('onnxruntime-node');
  }
  return ort;
}

export interface EnhanceResult {
  enhancedPath: string;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
  fileSize: number;
}

export class ImageEnhancer {
  // Default tile size for tiling strategy (smaller = less memory, but more tiles)
  private static TILE_SIZE = 256;
  private static TILE_PAD = 16; // Overlap padding to avoid seam artifacts

  /**
   * Evaluates whether an image would benefit from AI enhancement
   */
  public static shouldSuggestEnhance(width: number, height: number): boolean {
    return width < 1600 || height < 1600;
  }

  /**
   * Gets the path to the Real-ESRGAN ONNX model file
   */
  private static getModelPath(): string {
    const isDev = !app?.isPackaged;
    const baseDir = isDev ? process.cwd() : (process.resourcesPath || process.cwd());
    const candidate = path.join(baseDir, 'models', 'realesrgan-x2plus.onnx');
    if (fs.existsSync(candidate)) return candidate;
    const cwdFallback = path.join(process.cwd(), 'models', 'realesrgan-x2plus.onnx');
    if (fs.existsSync(cwdFallback)) return cwdFallback;
    return candidate;
  }

  /**
   * Creates or returns cached ONNX inference session
   */
  private static async getSession(): Promise<any> {
    if (cachedSession) return cachedSession;

    const ORT = getOrt();
    const modelPath = this.getModelPath();

    if (!fs.existsSync(modelPath)) {
      throw new Error(
        `Model Real-ESRGAN không tìm thấy tại: ${modelPath}\n` +
        `Vui lòng tải model về thư mục models/realesrgan-x2plus.onnx`
      );
    }

    console.log('[ImageEnhancer] Loading Real-ESRGAN x2plus ONNX model...');
    const startTime = Date.now();

    cachedSession = await ORT.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });

    console.log(`[ImageEnhancer] Model loaded in ${Date.now() - startTime}ms`);
    return cachedSession;
  }

  /**
   * Converts a Sharp image buffer to an NCHW float32 tensor normalized to [0, 1]
   */
  private static imageToTensor(
    rawPixels: Buffer,
    width: number,
    height: number,
    channels: number
  ): Float32Array {
    const pixelCount = width * height;
    const tensorData = new Float32Array(1 * 3 * pixelCount);

    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * channels;
      // NHWC -> NCHW, normalize [0, 255] -> [0.0, 1.0]
      tensorData[0 * pixelCount + i] = rawPixels[srcIdx + 0] / 255.0;     // R
      tensorData[1 * pixelCount + i] = rawPixels[srcIdx + 1] / 255.0;     // G
      tensorData[2 * pixelCount + i] = rawPixels[srcIdx + 2] / 255.0;     // B
    }

    return tensorData;
  }

  /**
   * Converts an NCHW float32 tensor back to RGB uint8 buffer
   */
  private static tensorToImage(
    tensorData: Float32Array,
    width: number,
    height: number
  ): Buffer {
    const pixelCount = width * height;
    const output = Buffer.alloc(pixelCount * 3);

    for (let i = 0; i < pixelCount; i++) {
      const r = Math.max(0, Math.min(255, Math.round(tensorData[0 * pixelCount + i] * 255)));
      const g = Math.max(0, Math.min(255, Math.round(tensorData[1 * pixelCount + i] * 255)));
      const b = Math.max(0, Math.min(255, Math.round(tensorData[2 * pixelCount + i] * 255)));
      output[i * 3 + 0] = r;
      output[i * 3 + 1] = g;
      output[i * 3 + 2] = b;
    }

    return output;
  }

  /**
   * Runs Real-ESRGAN inference on a single tile
   */
  private static async processTile(
    session: any,
    tilePixels: Buffer,
    tileW: number,
    tileH: number
  ): Promise<{ data: Buffer; width: number; height: number }> {
    const ORT = getOrt();
    const inputTensor = this.imageToTensor(tilePixels, tileW, tileH, 3);
    const tensor = new ORT.Tensor('float32', inputTensor, [1, 3, tileH, tileW]);
    const feeds = { [session.inputNames[0]]: tensor };

    const results = await session.run(feeds);
    const output = results[session.outputNames[0]];

    const outW = output.dims[3]; // 2x width
    const outH = output.dims[2]; // 2x height
    const outData = this.tensorToImage(output.data as Float32Array, outW, outH);

    return { data: outData, width: outW, height: outH };
  }

  /**
   * Performs Real-ESRGAN AI Super Resolution with tiling strategy:
   * - Splits large images into overlapping tiles
   * - Processes each tile through the neural network
   * - Stitches tiles back together with seamless blending
   * - Result: genuine AI-upscaled image with restored textures and sharp text
   */
  public static async enhanceImage(
    inputPath: string,
    _scaleFactor: 2 | 4 = 2  // Model is always 2x
  ): Promise<EnhanceResult> {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`File không tồn tại: ${inputPath}`);
    }

    const session = await this.getSession();

    const meta = await sharp(inputPath).metadata();
    const origW = meta.width || 800;
    const origH = meta.height || 800;
    const inputFormat = (meta.format || 'jpeg').toLowerCase();

    const outW = origW * 2;
    const outH = origH * 2;

    console.log(`[ImageEnhancer] Processing ${origW}x${origH} -> ${outW}x${outH} via Real-ESRGAN x2plus`);
    const startTime = Date.now();

    // Extract raw RGB pixels from input image
    const { data: rawPixels } = await sharp(inputPath)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tileSize = this.TILE_SIZE;
    const tilePad = this.TILE_PAD;

    // Calculate tile grid
    const tilesX = Math.ceil(origW / tileSize);
    const tilesY = Math.ceil(origH / tileSize);
    const totalTiles = tilesX * tilesY;

    console.log(`[ImageEnhancer] Tiling: ${tilesX}x${tilesY} = ${totalTiles} tiles (tile=${tileSize}px, pad=${tilePad}px)`);

    // Allocate output buffer (2x dimensions, RGB)
    const outputBuffer = Buffer.alloc(outW * outH * 3);

    let tileCount = 0;
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        // Calculate tile boundaries with padding
        const inputLeft = tx * tileSize;
        const inputTop = ty * tileSize;
        const inputRight = Math.min(inputLeft + tileSize, origW);
        const inputBottom = Math.min(inputTop + tileSize, origH);

        // Add padding (clamped to image bounds)
        const padLeft = Math.max(0, inputLeft - tilePad);
        const padTop = Math.max(0, inputTop - tilePad);
        const padRight = Math.min(origW, inputRight + tilePad);
        const padBottom = Math.min(origH, inputBottom + tilePad);

        const padW = padRight - padLeft;
        const padH = padBottom - padTop;

        // Extract padded tile from raw pixels
        const tilePixels = Buffer.alloc(padW * padH * 3);
        for (let y = 0; y < padH; y++) {
          const srcY = padTop + y;
          const srcOffset = (srcY * origW + padLeft) * 3;
          const dstOffset = y * padW * 3;
          rawPixels.copy(tilePixels, dstOffset, srcOffset, srcOffset + padW * 3);
        }

        // Run AI inference on this tile
        const result = await this.processTile(session, tilePixels, padW, padH);

        // Calculate where to place the result in the output (exclude padding in output space)
        const outPadOffsetX = (inputLeft - padLeft) * 2;
        const outPadOffsetY = (inputTop - padTop) * 2;
        const copyW = (inputRight - inputLeft) * 2;
        const copyH = (inputBottom - inputTop) * 2;
        const outStartX = inputLeft * 2;
        const outStartY = inputTop * 2;

        // Copy the relevant (non-padded) region to the output buffer
        for (let y = 0; y < copyH; y++) {
          const srcOffset = ((outPadOffsetY + y) * result.width + outPadOffsetX) * 3;
          const dstOffset = ((outStartY + y) * outW + outStartX) * 3;
          result.data.copy(outputBuffer, dstOffset, srcOffset, srcOffset + copyW * 3);
        }

        tileCount++;
        if (tileCount % 10 === 0 || tileCount === totalTiles) {
          console.log(`[ImageEnhancer] Progress: ${tileCount}/${totalTiles} tiles (${Math.round(tileCount / totalTiles * 100)}%)`);
        }
      }
    }

    // Prepare destination path
    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const base = path.basename(inputPath, ext);
    const enhancedName = `${base}-ai-enhanced${ext || '.jpg'}`;
    const enhancedPath = path.join(dir, enhancedName);

    // Encode output with high quality, preserving original format
    let outputPipeline = sharp(outputBuffer, {
      raw: { width: outW, height: outH, channels: 3 },
    });

    if (inputFormat === 'png') {
      outputPipeline = outputPipeline.png({ compressionLevel: 6 });
    } else if (inputFormat === 'webp') {
      outputPipeline = outputPipeline.webp({ quality: 96 });
    } else {
      outputPipeline = outputPipeline.jpeg({
        quality: 96,
        chromaSubsampling: '4:4:4',
        mozjpeg: true,
      });
    }

    await outputPipeline.toFile(enhancedPath);

    const finalStat = await fs.promises.stat(enhancedPath);
    const elapsed = Date.now() - startTime;
    console.log(`[ImageEnhancer] Done! ${origW}x${origH} -> ${outW}x${outH} in ${(elapsed / 1000).toFixed(1)}s (${enhancedPath})`);

    return {
      enhancedPath,
      originalWidth: origW,
      originalHeight: origH,
      newWidth: outW,
      newHeight: outH,
      fileSize: finalStat.size,
    };
  }
}
