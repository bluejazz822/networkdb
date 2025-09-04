import { Sequelize, QueryTypes, Transaction, ConnectionError, ValidationError } from 'sequelize';
import { databaseConfig, initializeDatabase } from '../config/database';
import { environment } from '../config/environment';
import winston from 'winston';

// Logger for database utilities
const logger = winston.createLogger({
  level: environment.database.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

/**
 * Database connection utility class
 * Provides high-level database operations with error handling and monitoring
 */
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private sequelize: Sequelize | null = null;
  private isInitialized = false;
  private healthCheckInterval: NodeJS.Timer | null = null;
  private connectionMetrics = {
    totalConnections: 0,
    successfulConnections: 0,
    failedConnections: 0,
    averageConnectionTime: 0,
    lastConnectionAttempt: null as Date | null,
    lastSuccessfulConnection: null as Date | null,
  };

  private constructor() {}

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Initialize database connection
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Database connection already initialized');
      return;
    }

    const startTime = Date.now();
    this.connectionMetrics.totalConnections++;
    this.connectionMetrics.lastConnectionAttempt = new Date();

    try {
      logger.info('Initializing database connection...');
      this.sequelize = await initializeDatabase();
      
      const connectionTime = Date.now() - startTime;
      this.connectionMetrics.successfulConnections++;
      this.connectionMetrics.lastSuccessfulConnection = new Date();
      this.connectionMetrics.averageConnectionTime = this.calculateAverageConnectionTime(connectionTime);
      
      this.isInitialized = true;
      this.startHealthCheckMonitoring();
      
      logger.info(`Database connection initialized successfully in ${connectionTime}ms`);
    } catch (error) {
      this.connectionMetrics.failedConnections++;
      logger.error('Failed to initialize database connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new DatabaseConnectionError('Failed to initialize database connection', error);
    }
  }

  /**
   * Execute raw SQL query with error handling
   */
  public async executeQuery(
    query: string,
    replacements?: Record<string, any>,
    options?: {
      type?: QueryTypes;
      transaction?: Transaction;
      timeout?: number;
    }
  ): Promise<any> {
    await this.ensureConnection();
    
    const startTime = Date.now();
    const queryOptions = {
      replacements,
      type: options?.type || QueryTypes.SELECT,
      transaction: options?.transaction,
      timeout: options?.timeout || environment.database.connection.commandTimeout,
    };

    try {
      logger.debug('Executing query', { 
        query: query.substring(0, 200),
        hasReplacements: !!replacements,
        type: queryOptions.type,
      });

      const result = await this.sequelize!.query(query, queryOptions);
      const executionTime = Date.now() - startTime;
      
      logger.debug(`Query executed successfully in ${executionTime}ms`);
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Query execution failed', {
        query: query.substring(0, 200),
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new DatabaseQueryError('Query execution failed', error, {
        query: query.substring(0, 200),
        executionTime,
      });
    }
  }

  /**
   * Execute transaction with automatic rollback on error
   */
  public async executeTransaction<T>(
    callback: (transaction: Transaction) => Promise<T>
  ): Promise<T> {
    await this.ensureConnection();
    
    const transaction = await this.sequelize!.transaction();
    const startTime = Date.now();

    try {
      logger.debug('Starting database transaction');
      const result = await callback(transaction);
      
      await transaction.commit();
      const executionTime = Date.now() - startTime;
      
      logger.debug(`Transaction completed successfully in ${executionTime}ms`);
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Transaction failed, rolling back', {
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      await transaction.rollback();
      throw new DatabaseTransactionError('Transaction failed and was rolled back', error);
    }
  }

  /**
   * Check database health
   */
  public async checkHealth(): Promise<DatabaseHealthStatus> {
    const healthStatus: DatabaseHealthStatus = {
      connected: false,
      latency: 0,
      timestamp: new Date(),
      connectionInfo: null,
      error: null,
    };

    const startTime = Date.now();

    try {
      await this.ensureConnection();
      
      // Test connection with a simple query
      await this.sequelize!.authenticate();
      
      healthStatus.connected = true;
      healthStatus.latency = Date.now() - startTime;
      healthStatus.connectionInfo = databaseConfig.getConnectionInfo();
      
      logger.debug('Database health check passed', {
        latency: healthStatus.latency,
      });
      
    } catch (error) {
      healthStatus.error = error instanceof Error ? error.message : 'Unknown error';
      healthStatus.latency = Date.now() - startTime;
      
      logger.warn('Database health check failed', {
        error: healthStatus.error,
        latency: healthStatus.latency,
      });
    }

    return healthStatus;
  }

  /**
   * Get connection metrics
   */
  public getConnectionMetrics(): ConnectionMetrics {
    return {
      ...this.connectionMetrics,
      isInitialized: this.isInitialized,
      currentConnections: this.getCurrentConnectionCount(),
    };
  }

  /**
   * Get Sequelize instance
   */
  public getSequelize(): Sequelize {
    if (!this.sequelize) {
      throw new DatabaseConnectionError('Database not initialized. Call initialize() first.');
    }
    return this.sequelize;
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    this.stopHealthCheckMonitoring();
    
    if (this.sequelize) {
      await databaseConfig.close();
      this.sequelize = null;
      this.isInitialized = false;
      logger.info('Database connection closed');
    }
  }

  /**
   * Ensure database connection is established
   */
  private async ensureConnection(): Promise<void> {
    if (!this.isInitialized || !this.sequelize) {
      await this.initialize();
    }
    
    // Double-check connection health
    const isConnected = await databaseConfig.isConnected();
    if (!isConnected) {
      logger.warn('Database connection lost, attempting to reconnect...');
      this.isInitialized = false;
      await this.initialize();
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheckMonitoring(): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        if (!health.connected) {
          logger.warn('Health check detected connection issue', {
            error: health.error,
            latency: health.latency,
          });
        }
      } catch (error) {
        logger.error('Health check monitoring error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, environment.healthCheck.interval);

    logger.info(`Database health monitoring started (interval: ${environment.healthCheck.interval}ms)`);
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheckMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Database health monitoring stopped');
    }
  }

  /**
   * Calculate average connection time
   */
  private calculateAverageConnectionTime(newTime: number): number {
    const currentAvg = this.connectionMetrics.averageConnectionTime;
    const successfulConnections = this.connectionMetrics.successfulConnections;
    
    if (successfulConnections <= 1) {
      return newTime;
    }
    
    return ((currentAvg * (successfulConnections - 1)) + newTime) / successfulConnections;
  }

  /**
   * Get current connection count from pool
   */
  private getCurrentConnectionCount(): number {
    if (!this.sequelize) {
      return 0;
    }

    try {
      const connectionManager = (this.sequelize.connectionManager as any);
      return connectionManager.pool?.used?.length || 0;
    } catch (error) {
      return 0;
    }
  }
}

// Custom error classes
export class DatabaseConnectionError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

export class DatabaseQueryError extends Error {
  constructor(
    message: string, 
    public originalError?: any, 
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'DatabaseQueryError';
  }
}

export class DatabaseTransactionError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'DatabaseTransactionError';
  }
}

// Type definitions
export interface DatabaseHealthStatus {
  connected: boolean;
  latency: number;
  timestamp: Date;
  connectionInfo: any;
  error: string | null;
}

export interface ConnectionMetrics {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  averageConnectionTime: number;
  lastConnectionAttempt: Date | null;
  lastSuccessfulConnection: Date | null;
  isInitialized: boolean;
  currentConnections: number;
}

// Export singleton instance
export const dbConnection = DatabaseConnection.getInstance();

// Convenience functions
export const initializeDbConnection = async (): Promise<void> => {
  return dbConnection.initialize();
};

export const executeQuery = async (
  query: string,
  replacements?: Record<string, any>,
  options?: {
    type?: QueryTypes;
    transaction?: Transaction;
    timeout?: number;
  }
): Promise<any> => {
  return dbConnection.executeQuery(query, replacements, options);
};

export const executeTransaction = async <T>(
  callback: (transaction: Transaction) => Promise<T>
): Promise<T> => {
  return dbConnection.executeTransaction(callback);
};

export const checkDatabaseHealth = async (): Promise<DatabaseHealthStatus> => {
  return dbConnection.checkHealth();
};

export const getConnectionMetrics = (): ConnectionMetrics => {
  return dbConnection.getConnectionMetrics();
};

export const closeDbConnection = async (): Promise<void> => {
  return dbConnection.close();
};