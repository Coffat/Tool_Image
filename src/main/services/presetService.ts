import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Preset } from '../../shared/types';
import { DEFAULT_PRESETS } from '../../shared/constants';

export class PresetService {
  private static getStoragePath(): string {
    try {
      const userData = app?.getPath ? app.getPath('userData') : process.cwd();
      return path.join(userData, 'phuong_nam_presets.json');
    } catch {
      return path.join(process.cwd(), 'phuong_nam_presets.json');
    }
  }

  public static async getAllPresets(): Promise<Preset[]> {
    const filePath = this.getStoragePath();
    try {
      if (fs.existsSync(filePath)) {
        const raw = await fs.promises.readFile(filePath, 'utf-8');
        const customPresets: Preset[] = JSON.parse(raw);
        // Merge defaults with custom, keeping custom if duplicate IDs
        const customIds = new Set(customPresets.map((p) => p.id));
        const merged = [
          ...customPresets,
          ...DEFAULT_PRESETS.filter((p) => !customIds.has(p.id)),
        ];
        return merged;
      }
    } catch (err) {
      console.error('Error reading presets:', err);
    }
    return DEFAULT_PRESETS;
  }

  public static async savePreset(preset: Preset): Promise<Preset[]> {
    const filePath = this.getStoragePath();
    const current = await this.getAllPresets();
    const existingIndex = current.findIndex((p) => p.id === preset.id);

    if (existingIndex >= 0) {
      current[existingIndex] = preset;
    } else {
      current.push(preset);
    }

    await fs.promises.writeFile(filePath, JSON.stringify(current, null, 2), 'utf-8');
    return current;
  }

  public static async deletePreset(presetId: string): Promise<Preset[]> {
    const filePath = this.getStoragePath();
    const current = await this.getAllPresets();
    const filtered = current.filter((p) => p.id !== presetId);
    await fs.promises.writeFile(filePath, JSON.stringify(filtered, null, 2), 'utf-8');
    return filtered;
  }
}
