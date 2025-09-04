import { Sequelize, Options as SequelizeOptions } from 'sequelize';
import { environment } from './environment';
import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Logger setup for database operations
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

// Custom logging function for Sequelize
const sequelizeLogger = (msg: string) => {
  if (environment.database.logging.enabled) {
    logger.debug(`[Sequelize] ${msg}`);
  }
};

/**
 * Database configuration class
 * Handles Sequelize initialization, connection management, and configuration
 */
class DatabaseConfig {
  private static instance: DatabaseConfig;
  private sequelize: Sequelize | null = null;
  private connectionAttempts = 0;
  private readonly maxRetries = environment.database.connection.retryAttempts;
  private readonly retryDelay = environment.database.connection.retryDelay;

  private constructor() {}

  public static getInstance(): DatabaseConfig {
    if (!DatabaseConfig.instance) {
      DatabaseConfig.instance = new DatabaseConfig();
    }
    return DatabaseConfig.instance;
  }

  /**
   * Initialize Sequelize with optimized configuration
   */
  public async initialize(): Promise<Sequelize> {
    if (this.sequelize) {
      return this.sequelize;
    }

    const config = this.buildSequelizeConfig();
    this.sequelize = new Sequelize(config);

    await this.testConnection();
    return this.sequelize;
  }

  /**
   * Build Sequelize configuration object
   */
  private buildSequelizeConfig(): SequelizeOptions {
    const { database: dbConfig } = environment;
    
    const config: SequelizeOptions = {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.name,
      username: dbConfig.user,
      password: dbConfig.password,
      dialect: 'mysql',
      
      // Connection pool configuration
      pool: {
        min: dbConfig.pool.min,
        max: dbConfig.pool.max,
        acquire: dbConfig.pool.acquire,
        idle: dbConfig.pool.idle,
        evict: dbConfig.pool.evict,
      },
      
      // Connection options
      dialectOptions: {
        connectTimeout: dbConfig.connection.timeout,
        acquireTimeout: dbConfig.connection.timeout,
        timeout: dbConfig.connection.commandTimeout,
        
        // SSL configuration
        ...(dbConfig.ssl.enabled && {
          ssl: this.buildSSLConfig(),
        }),
        
        // MySQL specific options
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
        multipleStatements: false,
        flags: ['-FOUND_ROWS'],
      },
      
      // Logging configuration
      logging: dbConfig.logging.enabled ? sequelizeLogger : false,
      
      // Query configuration
      query: {
        raw: false,
        nest: false,
      },
      
      // Timezone configuration
      timezone: '+00:00',
      
      // Model options
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        paranoid: false,
      },
      
      // Sync options (disabled in production)
      sync: {
        force: false,
        alter: environment.isDevelopment(),
      },
      
      // Benchmark queries in development
      benchmark: environment.isDevelopment(),
      
      // Retry configuration
      retry: {
        max: this.maxRetries,
        backoffBase: this.retryDelay,
        backoffExponent: 1.5,
      },
      
      // Hooks for connection events
      hooks: {
        beforeConnect: this.beforeConnectHook.bind(this),
        afterConnect: this.afterConnectHook.bind(this),
        beforeDisconnect: this.beforeDisconnectHook.bind(this),
      },
    };

    return config;
  }

  /**
   * Build SSL configuration if enabled
   */
  private buildSSLConfig(): object {
    const { ssl } = environment.database;
    const sslConfig: any = {
      require: true,
      rejectUnauthorized: environment.isProduction(),
    };

    if (ssl.ca && fs.existsSync(ssl.ca)) {
      sslConfig.ca = fs.readFileSync(ssl.ca);
    }

    if (ssl.cert && fs.existsSync(ssl.cert)) {
      sslConfig.cert = fs.readFileSync(ssl.cert);
    }

    if (ssl.key && fs.existsSync(ssl.key)) {
      sslConfig.key = fs.readFileSync(ssl.key);
    }

    return sslConfig;
  }

  /**
   * Test database connection with retry logic
   */
  private async testConnection(): Promise<void> {
    if (!this.sequelize) {
      throw new Error('Sequelize instance not initialized');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        await this.sequelize.authenticate();
        logger.info(`Database connection established successfully (attempt ${attempt})`);
        this.connectionAttempts = 0;
        return;
      } catch (error) {
        lastError = error as Error;
        this.connectionAttempts = attempt;
        
        if (attempt <= this.maxRetries) {
          const delay = this.retryDelay * Math.pow(1.5, attempt - 1);
          logger.warn(`Database connection failed (attempt ${attempt}/${this.maxRetries + 1}). Retrying in ${delay}ms...`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          
          await this.sleep(delay);
        }
      }
    }

    logger.error('Database connection failed after all retry attempts', {
      attempts: this.connectionAttempts,
      error: lastError?.message,
    });
    
    throw new Error(`Database connection failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Get Sequelize instance
   */
  public getSequelize(): Sequelize {
    if (!this.sequelize) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.sequelize;
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    if (this.sequelize) {
      await this.sequelize.close();
      logger.info('Database connection closed');
      this.sequelize = null;
    }
  }

  /**
   * Check if database is connected
   */
  public async isConnected(): Promise<boolean> {
    if (!this.sequelize) {
      return false;
    }

    try {
      await this.sequelize.authenticate();
      return true;
    } catch (error) {
      logger.warn('Database connection check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get connection information
   */
  public getConnectionInfo(): object {
    if (!this.sequelize) {
      return { connected: false };
    }

    const config = this.sequelize.config;
    return {
      connected: true,
      host: config.host,
      port: config.port,
      database: config.database,
      dialect: config.dialect,
      pool: {
        min: config.pool?.min || 0,
        max: config.pool?.max || 5,
        used: (this.sequelize.connectionManager as any).pool?.used?.length || 0,
        waiting: (this.sequelize.connectionManager as any).pool?.pending?.length || 0,
      },
      connectionAttempts: this.connectionAttempts,
    };
  }

  // Sequelize hooks
  private beforeConnectHook(): void {
    logger.debug('Attempting to connect to database');
  }

  private afterConnectHook(): void {
    logger.debug('Successfully connected to database');
  }

  private beforeDisconnectHook(): void {
    logger.debug('Disconnecting from database');
  }

  // Utility method
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const databaseConfig = DatabaseConfig.getInstance();

// Export Sequelize instance getter for convenience
export const getDatabase = (): Sequelize => {
  return databaseConfig.getSequelize();
};

// Export initialization function
export const initializeDatabase = async (): Promise<Sequelize> => {
  return databaseConfig.initialize();
};

// Export connection management functions
export const closeDatabaseConnection = async (): Promise<void> => {
  return databaseConfig.close();
};

export const isDatabaseConnected = async (): Promise<boolean> => {
  return databaseConfig.isConnected();
};

export const getDatabaseConnectionInfo = (): object => {
  return databaseConfig.getConnectionInfo();
};