/**
 * Bulk Operations API Routes
 * Handles bulk create, update, delete operations with progress tracking
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { BulkOperationService } from '../../services/bulk/BulkOperationService';
import { TemplateFactory } from '../../utils/templates';
import { processFileBuffer } from '../../utils/file-processors';
import { ImportService } from '../../services/import-export/ImportService';
import { ExportService } from '../../services/import-export/ExportService';
import { FileFormat } from '../../utils/file-processors/types';

const router: Router = Router();
const bulkService = new BulkOperationService();
const importService = new ImportService();
const exportService = new ExportService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * POST /api/bulk/templates/generate
 * Generate template for bulk operations
 */
router.post('/templates/generate', async (req: Request, res: Response) => {
  try {
    const { resourceType, format, options = {} } = req.body;

    if (!resourceType || !format) {
      return res.status(400).json({
        success: false,
        error: 'Resource type and format are required'
      });
    }

    const templateOptions = {
      includeSampleData: true,
      includeDescriptions: true,
      includeValidation: true,
      maxSampleRecords: 5,
      ...options
    };

    const result = await TemplateFactory.generateTemplate(
      resourceType,
      format,
      templateOptions
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Template generation failed',
        details: result.errors
      });
    }

    // Set appropriate headers for file download
    const extension = format.toLowerCase();
    const filename = `${resourceType}-bulk-template.${extension}`;
    
    res.setHeader('Content-Type', getContentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', result.buffer.length);

    return res.send(result.buffer);

  } catch (error) {
    console.error('Template generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/bulk/templates/config/:resourceType
 * Get template configuration for resource type
 */
router.get('/templates/config/:resourceType', async (req: Request, res: Response) => {
  try {
    const { resourceType } = req.params;
    
    const config = TemplateFactory.getTemplateConfig(resourceType);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: `No template configuration found for resource type: ${resourceType}`
      });
    }

    const stats = TemplateFactory.getTemplateStats(resourceType);

    return res.json({
      success: true,
      data: {
        config,
        stats
      }
    });

  } catch (error) {
    console.error('Template config error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/bulk/import
 * Start bulk import operation
 */
router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const {
      resourceType,
      mode = 'create',
      fieldMapping,
      continueOnError = true,
      enableRollback = false,
      batchSize = 50
    } = req.body;

    if (!resourceType) {
      return res.status(400).json({
        success: false,
        error: 'Resource type is required'
      });
    }

    // Parse field mapping if provided as string
    let parsedFieldMapping;
    if (fieldMapping) {
      try {
        parsedFieldMapping = typeof fieldMapping === 'string' 
          ? JSON.parse(fieldMapping) 
          : fieldMapping;
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid field mapping format'
        });
      }
    }

    // Determine file format from mimetype
    const format = getFileFormatFromMimetype(req.file.mimetype);
    
    if (!format) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported file format'
      });
    }

    const fileMetadata = {
      filename: req.file.filename || 'upload',
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      encoding: req.file.encoding || 'utf8',
      uploadedAt: new Date(),
      format
    };

    // Start import operation
    const importOptions = {
      mode,
      resourceType,
      format,
      fieldMapping: parsedFieldMapping,
      continueOnError: continueOnError === 'true' || continueOnError === true,
      rollbackOnFailure: enableRollback === 'true' || enableRollback === true,
      batchSize: parseInt(batchSize) || 50,
      userId: req.user?.id
    };

    const { importId, promise } = await importService.executeImport(
      req.file.buffer,
      fileMetadata,
      importOptions
    );

    return res.json({
      success: true,
      data: {
        importId,
        message: 'Bulk import operation started'
      }
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start bulk import',
      message: error.message
    });
  }
});

/**
 * POST /api/bulk/export
 * Start bulk export operation
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const {
      resourceType,
      format,
      fields,
      fieldOrder,
      filters,
      advancedFilters,
      sortBy,
      aggregations,
      includeHeaders = true,
      includeMetadata = true,
      fileName
    } = req.body;

    if (!resourceType || !format) {
      return res.status(400).json({
        success: false,
        error: 'Resource type and format are required'
      });
    }

    const exportOptions = {
      format,
      resourceType,
      fields,
      fieldOrder,
      filters,
      advancedFilters,
      sortBy,
      aggregations,
      includeHeaders,
      includeMetadata,
      fileName,
      userId: req.user?.id
    };

    const { exportId, promise } = await exportService.executeExport(exportOptions);

    return res.json({
      success: true,
      data: {
        exportId,
        message: 'Bulk export operation started'
      }
    });

  } catch (error) {
    console.error('Bulk export error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start bulk export',
      message: error.message
    });
  }
});

/**
 * POST /api/bulk/operations
 * Queue bulk operation (create, update, delete, upsert)
 */
router.post('/operations', async (req: Request, res: Response) => {
  try {
    const {
      operationType,
      resourceType,
      records,
      config = {},
      priority = 'normal'
    } = req.body;

    if (!operationType || !resourceType || !records) {
      return res.status(400).json({
        success: false,
        error: 'Operation type, resource type, and records are required'
      });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Records must be a non-empty array'
      });
    }

    const operationId = await bulkService.queueBulkOperation(
      operationType,
      resourceType,
      records,
      { ...config, userId: req.user?.id },
      priority
    );

    return res.json({
      success: true,
      data: {
        operationId,
        message: `Bulk ${operationType} operation queued`
      }
    });

  } catch (error) {
    console.error('Bulk operation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to queue bulk operation',
      message: error.message
    });
  }
});

/**
 * GET /api/bulk/operations/:operationId/progress
 * Get bulk operation progress
 */
router.get('/operations/:operationId/progress', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    
    let progress = bulkService.getOperationProgress(operationId);
    
    // Also check import service if not found in bulk service
    if (!progress) {
      progress = importService.getImportProgress(operationId);
    }
    
    // Also check export service
    if (!progress) {
      progress = exportService.getExportProgress(operationId);
    }

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Operation not found'
      });
    }

    return res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    console.error('Progress retrieval error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve operation progress'
    });
  }
});

/**
 * GET /api/bulk/operations/:operationId/result
 * Get bulk operation result
 */
router.get('/operations/:operationId/result', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    
    let result = bulkService.getOperationResult(operationId);
    
    // Also check import service
    if (!result) {
      result = importService.getImportResult(operationId);
    }
    
    // Also check export service
    if (!result) {
      result = exportService.getExportResult(operationId);
    }

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Operation result not found'
      });
    }

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Result retrieval error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve operation result'
    });
  }
});

/**
 * GET /api/bulk/export/:exportId/download
 * Download export file
 */
router.get('/export/:exportId/download', async (req: Request, res: Response) => {
  try {
    const { exportId } = req.params;
    
    const result = exportService.getExportResult(exportId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Export result not found'
      });
    }

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Export operation failed'
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', getContentType(result.format));
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('Content-Length', result.fileSize);

    return res.send(result.fileBuffer);

  } catch (error) {
    console.error('Export download error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to download export file'
    });
  }
});

/**
 * DELETE /api/bulk/operations/:operationId
 * Cancel bulk operation
 */
router.delete('/operations/:operationId', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    
    let cancelled = await bulkService.cancelOperation(operationId);
    
    // Try other services if not found
    if (!cancelled) {
      cancelled = await importService.cancelImport(operationId);
    }
    
    if (!cancelled) {
      cancelled = await exportService.cancelExport(operationId);
    }

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Operation not found or cannot be cancelled'
      });
    }

    return res.json({
      success: true,
      data: {
        message: 'Operation cancelled successfully'
      }
    });

  } catch (error) {
    console.error('Operation cancellation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel operation'
    });
  }
});

/**
 * GET /api/bulk/stats
 * Get bulk operation statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const bulkStats = bulkService.getOperationStats();
    
    const stats = {
      bulkOperations: bulkStats,
      activeOperations: bulkService.getActiveOperations(),
      systemStatus: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    };

    return res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Stats retrieval error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

/**
 * Helper function to get content type from format
 */
function getContentType(format: FileFormat): string {
  switch (format) {
    case FileFormat.CSV:
      return 'text/csv';
    case FileFormat.JSON:
      return 'application/json';
    case FileFormat.EXCEL:
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Helper function to get file format from mimetype
 */
function getFileFormatFromMimetype(mimetype: string): FileFormat | null {
  const mimeTypeMap: Record<string, FileFormat> = {
    'text/csv': FileFormat.CSV,
    'application/csv': FileFormat.CSV,
    'application/json': FileFormat.JSON,
    'text/json': FileFormat.JSON,
    'application/vnd.ms-excel': FileFormat.EXCEL,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileFormat.EXCEL
  };

  return mimeTypeMap[mimetype] || null;
}

export default router;