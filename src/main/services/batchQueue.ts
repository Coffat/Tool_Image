import { ProcessImageParams, ImageProcessor } from './imageProcessor';

export interface BatchItemProgress {
  index: number;
  total: number;
  currentFilePath: string;
  status: 'processing' | 'success' | 'error';
  outputPath?: string;
  error?: string;
}

export interface BatchSummary {
  total: number;
  successCount: number;
  errorCount: number;
  isCancelled: boolean;
  results: Array<{
    filePath: string;
    status: 'success' | 'error' | 'cancelled';
    outputPath?: string;
    error?: string;
  }>;
}

export class BatchQueue {
  private isCancelled = false;
  private concurrency = 3;

  public cancel(): void {
    this.isCancelled = true;
  }

  public async run(
    items: ProcessImageParams[],
    onProgress?: (progress: BatchItemProgress) => void
  ): Promise<BatchSummary> {
    this.isCancelled = false;
    const total = items.length;
    let completedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    const results: BatchSummary['results'] = new Array(total);

    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < total) {
        if (this.isCancelled) {
          break;
        }

        const currentIndex = nextIndex++;
        const item = items[currentIndex];

        if (onProgress) {
          onProgress({
            index: currentIndex + 1,
            total,
            currentFilePath: item.imagePath,
            status: 'processing',
          });
        }

        try {
          const exportResult = await ImageProcessor.processAndExport(item);
          successCount++;
          results[currentIndex] = {
            filePath: item.imagePath,
            status: 'success',
            outputPath: exportResult.outputPath,
          };

          if (onProgress) {
            onProgress({
              index: currentIndex + 1,
              total,
              currentFilePath: item.imagePath,
              status: 'success',
              outputPath: exportResult.outputPath,
            });
          }
        } catch (err: any) {
          errorCount++;
          const errorMsg = err?.message || 'Lỗi không xác định khi xuất ảnh';
          results[currentIndex] = {
            filePath: item.imagePath,
            status: 'error',
            error: errorMsg,
          };

          if (onProgress) {
            onProgress({
              index: currentIndex + 1,
              total,
              currentFilePath: item.imagePath,
              status: 'error',
              error: errorMsg,
            });
          }
        }

        completedCount++;
      }
    };

    // Run workers concurrently up to this.concurrency
    const workerPromises: Promise<void>[] = [];
    const activeWorkers = Math.min(this.concurrency, total);

    for (let i = 0; i < activeWorkers; i++) {
      workerPromises.push(worker());
    }

    await Promise.all(workerPromises);

    // If cancelled, mark remaining unprocessed items as cancelled
    for (let i = 0; i < total; i++) {
      if (!results[i]) {
        results[i] = {
          filePath: items[i].imagePath,
          status: 'cancelled',
          error: 'Đã hủy theo yêu cầu của người dùng',
        };
      }
    }

    return {
      total,
      successCount,
      errorCount,
      isCancelled: this.isCancelled,
      results,
    };
  }
}
