import { Sequelize, Transaction, QueryTypes, Op } from 'sequelize';
import { performance } from 'perf_hooks';

/**
 * Database operations utilities for Network CMDB
 */
export class DatabaseOperations {
  private sequelize: Sequelize;
  private logger?: (message: string, data?: any) => void;

  constructor(sequelize: Sequelize, logger?: (message: string, data?: any) => void) {
    this.sequelize = sequelize;
    this.logger = logger;
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  async executeTransaction<T>(
    operation: (transaction: Transaction) => Promise<T>,
    options: { isolationLevel?: string; autocommit?: boolean } = {}
  ): Promise<T> {
    const transaction = await this.sequelize.transaction({
      isolationLevel: options.isolationLevel as any,
      autocommit: options.autocommit
    });

    try {
      const result = await operation(transaction);
      await transaction.commit();
      this.log('Transaction committed successfully');
      return result;
    } catch (error) {
      await transaction.rollback();
      this.log('Transaction rolled back due to error', { error: error.message });
      throw error;
    }
  }

  /**
   * Bulk insert records with performance monitoring
   */
  async bulkInsert(
    tableName: string,
    records: any[],
    options: {
      batchSize?: number;
      ignoreDuplicates?: boolean;
      updateOnDuplicate?: string[];
      transaction?: Transaction;
    } = {}
  ): Promise<{ insertedCount: number; duration: number }> {
    const startTime = performance.now();
    const batchSize = options.batchSize || 1000;
    let insertedCount = 0;

    this.log(`Starting bulk insert of ${records.length} records into ${tableName}`);

    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      await this.sequelize.getQueryInterface().bulkInsert(tableName, batch, {
        ignoreDuplicates: options.ignoreDuplicates,
        updateOnDuplicate: options.updateOnDuplicate,
        transaction: options.transaction
      });

      insertedCount += batch.length;
      this.log(`Inserted batch ${Math.floor(i / batchSize) + 1}, records: ${insertedCount}/${records.length}`);
    }

    const duration = performance.now() - startTime;
    this.log(`Bulk insert completed`, { 
      tableName, 
      insertedCount, 
      duration: `${duration.toFixed(2)}ms` 
    });

    return { insertedCount, duration };
  }

  /**
   * Bulk update records with performance monitoring
   */
  async bulkUpdate(
    tableName: string,
    updates: { values: any; where: any }[],
    options: {
      batchSize?: number;
      transaction?: Transaction;
    } = {}
  ): Promise<{ updatedCount: number; duration: number }> {
    const startTime = performance.now();
    const batchSize = options.batchSize || 1000;
    let updatedCount = 0;

    this.log(`Starting bulk update of ${updates.length} records in ${tableName}`);

    // Process in batches
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      for (const update of batch) {
        const [affectedRows] = await this.sequelize.getQueryInterface().bulkUpdate(
          tableName,
          update.values,
          update.where,
          { transaction: options.transaction }
        );
        updatedCount += affectedRows;
      }

      this.log(`Updated batch ${Math.floor(i / batchSize) + 1}, records: ${updatedCount}`);
    }

    const duration = performance.now() - startTime;
    this.log(`Bulk update completed`, { 
      tableName, 
      updatedCount, 
      duration: `${duration.toFixed(2)}ms` 
    });

    return { updatedCount, duration };
  }

  /**
   * Bulk delete records with performance monitoring
   */
  async bulkDelete(
    tableName: string,
    whereConditions: any[],
    options: {
      batchSize?: number;
      softDelete?: boolean;
      transaction?: Transaction;
    } = {}
  ): Promise<{ deletedCount: number; duration: number }> {
    const startTime = performance.now();
    const batchSize = options.batchSize || 1000;
    let deletedCount = 0;

    this.log(`Starting bulk delete of ${whereConditions.length} conditions in ${tableName}`);

    // Process in batches
    for (let i = 0; i < whereConditions.length; i += batchSize) {
      const batch = whereConditions.slice(i, i + batchSize);
      
      for (const whereCondition of batch) {
        let affectedRows: number;
        
        if (options.softDelete) {
          // Soft delete - update deletedAt column
          [affectedRows] = await this.sequelize.getQueryInterface().bulkUpdate(
            tableName,
            { deletedAt: new Date() },
            whereCondition,
            { transaction: options.transaction }
          );
        } else {
          // Hard delete
          affectedRows = await this.sequelize.getQueryInterface().bulkDelete(
            tableName,
            whereCondition,
            { transaction: options.transaction }
          );
        }
        
        deletedCount += affectedRows;
      }

      this.log(`Deleted batch ${Math.floor(i / batchSize) + 1}, records: ${deletedCount}`);
    }

    const duration = performance.now() - startTime;
    this.log(`Bulk delete completed`, { 
      tableName, 
      deletedCount, 
      softDelete: options.softDelete,
      duration: `${duration.toFixed(2)}ms` 
    });

    return { deletedCount, duration };
  }

  /**
   * Execute raw SQL query with performance monitoring
   */
  async executeRawQuery<T = any>(
    sql: string,
    replacements: any = {},
    options: {
      type?: QueryTypes;
      transaction?: Transaction;
    } = {}
  ): Promise<T> {
    const startTime = performance.now();
    
    this.log(`Executing raw query`, { sql: sql.substring(0, 100) + '...' });

    try {
      const result = await this.sequelize.query<T>(sql, {
        type: options.type || QueryTypes.RAW,
        replacements,
        transaction: options.transaction
      });

      const duration = performance.now() - startTime;
      this.log(`Raw query completed successfully`, { 
        duration: `${duration.toFixed(2)}ms` 
      });

      return result as T;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.log(`Raw query failed`, { 
        error: error.message,
        duration: `${duration.toFixed(2)}ms` 
      });
      throw error;
    }
  }

  /**
   * Get table statistics
   */
  async getTableStats(tableName: string): Promise<{
    rowCount: number;
    tableSize: string;
    indexSize: string;
    autoIncrement?: number;
  }> {
    const query = `
      SELECT 
        TABLE_ROWS as rowCount,
        ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) as tableSizeMB,
        ROUND((INDEX_LENGTH / 1024 / 1024), 2) as indexSizeMB,
        AUTO_INCREMENT as autoIncrement
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = :tableName
    `;

    const [result] = await this.sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements: { tableName }
    }) as any[];

    return {
      rowCount: result.rowCount || 0,
      tableSize: `${result.tableSizeMB || 0} MB`,
      indexSize: `${result.indexSizeMB || 0} MB`,
      autoIncrement: result.autoIncrement
    };
  }

  /**
   * Analyze table performance
   */
  async analyzeTablePerformance(tableName: string): Promise<{
    slowQueries: any[];
    indexUsage: any[];
    recommendations: string[];
  }> {
    // This is a simplified version - in production you'd want more sophisticated analysis
    const slowQueries = await this.sequelize.query(`
      SELECT * FROM mysql.slow_log 
      WHERE sql_text LIKE '%${tableName}%'
      ORDER BY start_time DESC 
      LIMIT 10
    `, { type: QueryTypes.SELECT }).catch(() => []);

    const indexUsage = await this.sequelize.query(`
      SELECT 
        TABLE_NAME,
        INDEX_NAME,
        SEQ_IN_INDEX,
        COLUMN_NAME,
        CARDINALITY
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = :tableName
      ORDER BY SEQ_IN_INDEX
    `, {
      type: QueryTypes.SELECT,
      replacements: { tableName }
    }) as any[];

    // Basic recommendations
    const recommendations = [];
    if (indexUsage.length === 0) {
      recommendations.push('Consider adding indexes to improve query performance');
    }
    if (slowQueries.length > 0) {
      recommendations.push('Slow queries detected - review and optimize');
    }

    return {
      slowQueries,
      indexUsage,
      recommendations
    };
  }

  /**
   * Vacuum/optimize table (MySQL OPTIMIZE)
   */
  async optimizeTable(tableName: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.sequelize.query(`OPTIMIZE TABLE ${tableName}`);
      this.log(`Table ${tableName} optimized successfully`);
      return { success: true, message: `Table ${tableName} optimized successfully` };
    } catch (error) {
      this.log(`Failed to optimize table ${tableName}`, { error: error.message });
      return { success: false, message: error.message };
    }
  }

  /**
   * Create database backup (MySQL dump)
   */
  async createBackup(options: {
    tables?: string[];
    outputPath?: string;
    includeData?: boolean;
  } = {}): Promise<{ success: boolean; message: string; backupPath?: string }> {
    // This would typically use mysqldump or similar
    // For now, we'll return a placeholder implementation
    this.log('Backup functionality would be implemented with mysqldump integration');
    
    return {
      success: false,
      message: 'Backup functionality requires mysqldump integration - not implemented in this version'
    };
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{
    connected: boolean;
    latency: number;
    version: string;
    uptime: number;
  }> {
    const startTime = performance.now();
    
    try {
      await this.sequelize.authenticate();
      const latency = performance.now() - startTime;
      
      const [versionResult] = await this.sequelize.query('SELECT VERSION() as version', {
        type: QueryTypes.SELECT
      }) as any[];
      
      const [uptimeResult] = await this.sequelize.query('SHOW STATUS LIKE "Uptime"', {
        type: QueryTypes.SELECT
      }) as any[];

      return {
        connected: true,
        latency,
        version: versionResult.version,
        uptime: parseInt(uptimeResult.Value)
      };
    } catch (error) {
      this.log('Health check failed', { error: error.message });
      return {
        connected: false,
        latency: -1,
        version: 'Unknown',
        uptime: 0
      };
    }
  }

  /**
   * Seed data utility
   */
  async seedData(
    tableName: string,
    seedData: any[],
    options: {
      clearExisting?: boolean;
      conflictResolution?: 'ignore' | 'replace' | 'update';
    } = {}
  ): Promise<{ seededCount: number; duration: number }> {
    return await this.executeTransaction(async (transaction) => {
      // Clear existing data if requested
      if (options.clearExisting) {
        await this.sequelize.getQueryInterface().bulkDelete(tableName, {}, { transaction });
        this.log(`Cleared existing data from ${tableName}`);
      }

      // Insert seed data
      const result = await this.bulkInsert(tableName, seedData, {
        ignoreDuplicates: options.conflictResolution === 'ignore',
        updateOnDuplicate: options.conflictResolution === 'update' ? Object.keys(seedData[0] || {}) : undefined,
        transaction
      });

      this.log(`Seeded ${result.insertedCount} records into ${tableName}`);
      return result;
    });
  }

  /**
   * Private logging method
   */
  private log(message: string, data?: any): void {
    if (this.logger) {
      this.logger(message, data);
    }
  }
}

/**
 * Factory function to create DatabaseOperations instance
 */
export function createDatabaseOperations(
  sequelize: Sequelize, 
  logger?: (message: string, data?: any) => void
): DatabaseOperations {
  return new DatabaseOperations(sequelize, logger);
}

/**
 * Common database operation patterns for Network CMDB
 */
export class NetworkCMDBOperations extends DatabaseOperations {
  /**
   * Sync network resources from AWS
   */
  async syncNetworkResources(
    resourceType: string,
    resources: any[],
    options: {
      sourceSystem: string;
      regionFilter?: string[];
    }
  ): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    await this.executeTransaction(async (transaction) => {
      for (const resource of resources) {
        try {
          // Add sync metadata
          const resourceWithMeta = {
            ...resource,
            sourceSystem: options.sourceSystem,
            lastSyncAt: new Date(),
            syncVersion: 1
          };

          await this.sequelize.getQueryInterface().bulkInsert(
            resourceType,
            [resourceWithMeta],
            {
              updateOnDuplicate: Object.keys(resourceWithMeta),
              transaction
            }
          );
          synced++;
        } catch (error) {
          this.log(`Error syncing resource ${resource.id}`, { error: error.message });
          errors++;
        }
      }
    });

    return { synced, errors };
  }

  /**
   * Archive old network resources
   */
  async archiveOldResources(
    tableName: string,
    olderThanDays: number = 30
  ): Promise<{ archived: number }> {
    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - olderThanDays);

    const result = await this.bulkDelete(tableName, [{
      deletedAt: {
        [Op.lt]: archiveDate
      }
    }], {
      softDelete: false // Actually delete old soft-deleted records
    });

    return { archived: result.deletedCount };
  }
}