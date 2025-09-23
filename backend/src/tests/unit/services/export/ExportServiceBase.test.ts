/**
 * ExportServiceBase Unit Tests
 * Tests for base export service infrastructure, progress tracking, and resource management
 */

import { ExportServiceBase } from '../../../../services/export/ExportServiceBase';
import {
  ExportFormat,
  ExportStatus,
  ExportOptions,
  ExportError
} from '../../../../types/export';

// Test implementation of ExportServiceBase
class TestExportService extends ExportServiceBase {
  public testData: any[] = [];
  public shouldThrowOnFetch = false;
  public shouldThrowOnFormat = false;

  protected async fetchData(options: ExportOptions): Promise<any[]> {
    if (this.shouldThrowOnFetch) {
      throw new Error('Test fetch error');
    }

    // Simulate data based on options
    const baseData = this.testData.length > 0 ? this.testData : [
      { id: 1, name: 'Test Item 1', type: options.resourceType },
      { id: 2, name: 'Test Item 2', type: options.resourceType },
      { id: 3, name: 'Test Item 3', type: options.resourceType }
    ];

    // Apply simple filtering if provided
    if (options.filters) {
      return baseData.filter(item => {
        return Object.entries(options.filters!).every(([key, value]) => {
          return item[key] === value;
        });
      });
    }

    return baseData;
  }

  protected async formatData(data: any[], format: ExportFormat, options: ExportOptions): Promise<Buffer> {
    if (this.shouldThrowOnFormat) {
      throw new Error('Test format error');
    }

    switch (format) {
      case ExportFormat.JSON:
        return Buffer.from(JSON.stringify(data, null, 2), 'utf8');
      case ExportFormat.CSV:
        if (data.length === 0) return Buffer.from('', 'utf8');
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(item => Object.values(item).join(',')).join('\n');
        return Buffer.from(`${headers}\n${rows}`, 'utf8');
      case ExportFormat.EXCEL:
        // Simulate Excel format with JSON for testing
        return Buffer.from(JSON.stringify({ format: 'excel', data }, null, 2), 'utf8');
      case ExportFormat.PDF:
        // Simulate PDF format with JSON for testing
        return Buffer.from(JSON.stringify({ format: 'pdf', data }, null, 2), 'utf8');
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  protected validateOptions(options: ExportOptions): void {
    if (options.resourceType === 'invalid') {
      throw new Error('Invalid resource type');
    }
  }

  // Expose protected methods for testing
  public async testProcessBatch(batch: any[], options: ExportOptions): Promise<any[]> {
    return this.processBatch(batch, options);
  }
}

describe('ExportServiceBase', () => {
  let exportService: TestExportService;

  beforeEach(() => {
    exportService = new TestExportService({
      maxConcurrentExports: 2,
      defaultBatchSize: 100,
      maxRecordsPerExport: 1000,
      tempFileLifetime: 60 * 1000, // 1 minute for testing
      cleanupInterval: 30 * 1000, // 30 seconds
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      compressionEnabled: false,
      allowedFormats: [ExportFormat.CSV, ExportFormat.JSON, ExportFormat.EXCEL, ExportFormat.PDF],
      maxFileSize: 10 * 1024 * 1024 // 10MB
    });
  });

  afterEach(async () => {
    if (exportService) {
      await exportService.shutdown();
    }
  });

  describe('Service Initialization', () => {
    it('should initialize service successfully', (done) => {
      const newService = new TestExportService();
      newService.once('service:initialized', (data) => {
        expect(data.config).toBeDefined();
        expect(data.config.maxConcurrentExports).toBeDefined();
        newService.shutdown().then(() => done());
      });
    });
  });

  describe('Export Operations', () => {
    it('should start export operation successfully', async () => {
      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'test',
        fields: ['id', 'name'],
        userId: 'test-user'
      };

      const exportId = await exportService.startExport(options);

      expect(exportId).toBeDefined();
      expect(exportId).toMatch(/^export_\d+_\w+$/);

      // Wait for export to complete
      await new Promise(resolve => {
        exportService.once('export:completed', resolve);
      });

      const result = exportService.getExportResult(exportId);
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(result!.format).toBe(ExportFormat.JSON);
      expect(result!.totalRecords).toBe(3);
      expect(result!.processedRecords).toBe(3);
    });

    it('should queue export when at capacity', async () => {
      // Fill up the concurrent export slots with slow operations
      exportService.testData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        type: 'test'
      }));

      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'test'
      };

      // Start exports to fill capacity
      const export1 = await exportService.startExport(options);
      const export2 = await exportService.startExport(options);

      // Third export should be queued
      const export3 = await exportService.queueExport(options);

      expect(export1).toBeDefined();
      expect(export2).toBeDefined();
      expect(export3).toBeDefined();

      // Clean up by waiting for completion
      await new Promise(resolve => {
        let completed = 0;
        exportService.on('export:completed', () => {
          completed++;
          if (completed === 3) resolve(null);
        });
      });
    });

    it('should track export progress correctly', async () => {
      const options: ExportOptions = {
        format: ExportFormat.CSV,
        resourceType: 'test'
      };

      const progressUpdates: any[] = [];
      const exportId = await exportService.startExport(options, (progress) => {
        progressUpdates.push({ ...progress });
      });

      // Wait for export to complete
      await new Promise(resolve => {
        exportService.once('export:completed', resolve);
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].status).toBe(ExportStatus.INITIALIZING);
      expect(progressUpdates[progressUpdates.length - 1].status).toBe(ExportStatus.COMPLETED);
      expect(progressUpdates[progressUpdates.length - 1].progress).toBe(100);
    });

    it('should handle export cancellation', async () => {
      exportService.testData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        type: 'test'
      }));

      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'test'
      };

      const exportId = await exportService.startExport(options);

      // Cancel export quickly
      setTimeout(async () => {
        await exportService.cancelExport(exportId);
      }, 10);

      // Wait for cancellation or completion
      await new Promise(resolve => {
        exportService.once('export:completed', resolve);
        exportService.once('export:failed', resolve);
        setTimeout(resolve, 1000); // Timeout in case of issues
      });

      const progress = exportService.getExportProgress(exportId);
      expect(progress?.status).toBe(ExportStatus.CANCELLED);
    });
  });

  describe('Data Processing', () => {
    it('should process data with field selection', async () => {
      const testData = [
        { id: 1, name: 'Item 1', description: 'Desc 1', extra: 'Extra 1' },
        { id: 2, name: 'Item 2', description: 'Desc 2', extra: 'Extra 2' }
      ];

      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'test',
        fields: ['id', 'name']
      };

      const processed = await exportService.testProcessBatch(testData, options);

      expect(processed).toHaveLength(2);
      expect(processed[0]).toEqual({ id: 1, name: 'Item 1' });
      expect(processed[1]).toEqual({ id: 2, name: 'Item 2' });
    });

    it('should process data without field selection', async () => {
      const testData = [
        { id: 1, name: 'Item 1', description: 'Desc 1' }
      ];

      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'test'
      };

      const processed = await exportService.testProcessBatch(testData, options);

      expect(processed).toHaveLength(1);
      expect(processed[0]).toEqual(testData[0]);
    });
  });

  describe('Format Support', () => {
    const testData = [
      { id: 1, name: 'Test Item 1' },
      { id: 2, name: 'Test Item 2' }
    ];

    beforeEach(() => {
      exportService.testData = testData;
    });

    it('should export as JSON format', async () => {
      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'test'
      };

      const exportId = await exportService.startExport(options);

      await new Promise(resolve => {
        exportService.once('export:completed', resolve);
      });

      const result = exportService.getExportResult(exportId);
      expect(result).toBeDefined();

      const data = JSON.parse(result!.fileBuffer!.toString('utf8'));
      expect(data).toEqual(testData);
    });

    it('should export as CSV format', async () => {
      const options: ExportOptions = {
        format: ExportFormat.CSV,
        resourceType: 'test'
      };

      const exportId = await exportService.startExport(options);

      await new Promise(resolve => {
        exportService.once('export:completed', resolve);
      });

      const result = exportService.getExportResult(exportId);
      expect(result).toBeDefined();

      const csvContent = result!.fileBuffer!.toString('utf8');
      expect(csvContent).toContain('id,name');
      expect(csvContent).toContain('1,Test Item 1');
      expect(csvContent).toContain('2,Test Item 2');
    });

    it('should export as Excel format', async () => {
      const options: ExportOptions = {
        format: ExportFormat.EXCEL,
        resourceType: 'test'
      };

      const exportId = await exportService.startExport(options);

      await new Promise(resolve => {
        exportService.once('export:completed', resolve);
      });

      const result = exportService.getExportResult(exportId);
      expect(result).toBeDefined();

      // For our test implementation, Excel is simulated as JSON
      const content = JSON.parse(result!.fileBuffer!.toString('utf8'));
      expect(content.format).toBe('excel');
      expect(content.data).toEqual(testData);
    });

    it('should export as PDF format', async () => {
      const options: ExportOptions = {
        format: ExportFormat.PDF,
        resourceType: 'test'
      };

      const exportId = await exportService.startExport(options);

      await new Promise(resolve => {
        exportService.once('export:completed', resolve);
      });

      const result = exportService.getExportResult(exportId);
      expect(result).toBeDefined();

      // For our test implementation, PDF is simulated as JSON
      const content = JSON.parse(result!.fileBuffer!.toString('utf8'));
      expect(content.format).toBe('pdf');
      expect(content.data).toEqual(testData);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'invalid' // This will trigger validation error
      };

      await expect(exportService.startExport(options)).rejects.toThrow(ExportError);
      await expect(exportService.startExport(options)).rejects.toMatchObject({
        code: 'START_ERROR'
      });
    });

    it('should handle unsupported format errors', async () => {
      const options: ExportOptions = {
        format: 'unsupported' as ExportFormat,
        resourceType: 'test'
      };

      await expect(exportService.startExport(options)).rejects.toThrow(ExportError);
      await expect(exportService.startExport(options)).rejects.toMatchObject({
        code: 'INVALID_FORMAT'
      });
    });

    it('should handle data fetch errors', async () => {
      exportService.shouldThrowOnFetch = true;

      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'test'
      };

      const exportId = await exportService.startExport(options);

      await new Promise(resolve => {
        exportService.once('export:failed', resolve);
      });

      const progress = exportService.getExportProgress(exportId);
      expect(progress?.status).toBe(ExportStatus.FAILED);
      expect(progress?.error).toContain('Test fetch error');
    });

    it('should handle data formatting errors', async () => {
      exportService.shouldThrowOnFormat = true;

      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'test'
      };

      const exportId = await exportService.startExport(options);

      await new Promise(resolve => {
        exportService.once('export:failed', resolve);
      });

      const progress = exportService.getExportProgress(exportId);
      expect(progress?.status).toBe(ExportStatus.FAILED);
      expect(progress?.error).toContain('Test format error');
    });
  });

  describe('Resource Management', () => {
    it('should track resource usage', async () => {
      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'test'
      };

      const exportId = await exportService.startExport(options);

      await new Promise(resolve => {
        exportService.once('export:completed', resolve);
      });

      const usage = exportService.getResourceUsage(exportId);
      expect(usage).toBeDefined();
      expect(usage!.totalProcessingTime).toBeGreaterThan(0);
    });

    it('should cleanup resources', async () => {
      // Create several exports
      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'test'
      };

      const export1 = await exportService.startExport(options);
      const export2 = await exportService.startExport(options);

      // Wait for completion
      await new Promise(resolve => {
        let completed = 0;
        exportService.on('export:completed', () => {
          completed++;
          if (completed === 2) resolve(null);
        });
      });

      const cleanupResult = await exportService.cleanupResources();
      expect(cleanupResult).toBeDefined();
      expect(cleanupResult.exportsCleanedUp).toBeGreaterThanOrEqual(0);
      expect(cleanupResult.filesCleanedUp).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Events', () => {
    it('should emit service events', (done) => {
      let eventsReceived = 0;
      const requiredEvents = ['service:initialized'];

      const newService = new TestExportService();

      requiredEvents.forEach(eventType => {
        newService.once(eventType as any, () => {
          eventsReceived++;
          if (eventsReceived === requiredEvents.length) {
            newService.shutdown().then(() => done());
          }
        });
      });
    });

    it('should emit export lifecycle events', async () => {
      const events: string[] = [];

      exportService.on('export:progress', () => events.push('progress'));
      exportService.on('export:completed', () => events.push('completed'));

      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'test'
      };

      await exportService.startExport(options);

      await new Promise(resolve => {
        exportService.once('export:completed', resolve);
      });

      expect(events).toContain('progress');
      expect(events).toContain('completed');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const shutdownPromise = new Promise(resolve => {
        exportService.once('service:shutdown', resolve);
      });

      await exportService.shutdown();
      await shutdownPromise;

      // Should not be able to start exports after shutdown
      const options: ExportOptions = {
        format: ExportFormat.JSON,
        resourceType: 'test'
      };

      await expect(exportService.startExport(options)).rejects.toThrow();
    });
  });
});