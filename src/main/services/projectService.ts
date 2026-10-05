import fs from 'fs';
import { ProjectData } from '../../shared/types';

export class ProjectService {
  public static async saveProject(filePath: string, data: ProjectData): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(filePath, json, 'utf-8');
  }

  public static async loadProject(filePath: string): Promise<{
    data: ProjectData;
    missingFiles: string[];
  }> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File dự án không tồn tại: ${filePath}`);
    }

    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const data: ProjectData = JSON.parse(raw);

    const missingFiles: string[] = [];
    // Verify each image file still exists on disk
    for (const img of data.images) {
      if (!fs.existsSync(img.filePath)) {
        missingFiles.push(img.filePath);
      }
    }

    // Verify logo file still exists
    if (data.activeLogoTransform?.logoPath && !fs.existsSync(data.activeLogoTransform.logoPath)) {
      missingFiles.push(data.activeLogoTransform.logoPath);
    }

    return {
      data,
      missingFiles,
    };
  }
}
