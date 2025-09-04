/**
 * Import/Export Services Export Module
 * Central export point for import and export functionality
 */

export { ImportService } from './ImportService';
export type { 
  ImportPreviewData, 
  ImportProgress, 
  ImportResult, 
  ImportOptions 
} from './ImportService';

export { ExportService } from './ExportService';
export type { 
  ExportProgress, 
  ExportResult, 
  ExportOptions 
} from './ExportService';

// Service Factory
let importServiceInstance: ImportService | null = null;
let exportServiceInstance: ExportService | null = null;

export class ImportExportServiceFactory {
  static getImportService(): ImportService {
    if (!importServiceInstance) {
      importServiceInstance = new ImportService();
    }
    return importServiceInstance;
  }

  static getExportService(): ExportService {
    if (!exportServiceInstance) {
      exportServiceInstance = new ExportService();
    }
    return exportServiceInstance;
  }

  static resetServices(): void {
    importServiceInstance = null;
    exportServiceInstance = null;
  }
}