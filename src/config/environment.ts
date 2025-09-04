import dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  
  // Database Configuration
  DB_HOST: Joi.string()
    .default('localhost')
    .description('MySQL database host'),
  
  DB_PORT: Joi.number()
    .port()
    .default(3306)
    .description('MySQL database port'),
  
  DB_NAME: Joi.string()
    .required()
    .description('MySQL database name'),
  
  DB_USER: Joi.string()
    .required()
    .description('MySQL database username'),
  
  DB_PASSWORD: Joi.string()
    .allow('')
    .default('')
    .description('MySQL database password'),
  
  // Connection Pool Configuration
  DB_POOL_MIN: Joi.number()
    .integer()
    .min(0)
    .default(5)
    .description('Minimum number of connections in pool'),
  
  DB_POOL_MAX: Joi.number()
    .integer()
    .min(1)
    .default(50)
    .description('Maximum number of connections in pool'),
  
  DB_POOL_ACQUIRE_TIMEOUT: Joi.number()
    .integer()
    .min(1000)
    .default(60000)
    .description('Pool acquire timeout in milliseconds'),
  
  DB_POOL_IDLE_TIMEOUT: Joi.number()
    .integer()
    .min(1000)
    .default(10000)
    .description('Pool idle timeout in milliseconds'),
  
  DB_POOL_EVICT_TIMEOUT: Joi.number()
    .integer()
    .min(1000)
    .default(60000)
    .description('Pool evict timeout in milliseconds'),
  
  // Connection Configuration
  DB_CONNECTION_TIMEOUT: Joi.number()
    .integer()
    .min(1000)
    .default(60000)
    .description('Connection timeout in milliseconds'),
  
  DB_COMMAND_TIMEOUT: Joi.number()
    .integer()
    .min(1000)
    .default(60000)
    .description('Command timeout in milliseconds'),
  
  DB_RETRY_ATTEMPTS: Joi.number()
    .integer()
    .min(0)
    .default(3)
    .description('Number of retry attempts for failed connections'),
  
  DB_RETRY_DELAY: Joi.number()
    .integer()
    .min(100)
    .default(1000)
    .description('Delay between retry attempts in milliseconds'),
  
  // SSL Configuration
  DB_SSL: Joi.boolean()
    .default(false)
    .description('Enable SSL for database connection'),
  
  DB_SSL_CA: Joi.string()
    .optional()
    .description('SSL Certificate Authority file path'),
  
  DB_SSL_CERT: Joi.string()
    .optional()
    .description('SSL certificate file path'),
  
  DB_SSL_KEY: Joi.string()
    .optional()
    .description('SSL key file path'),
  
  // Logging Configuration
  DB_LOGGING: Joi.boolean()
    .default(false)
    .description('Enable database query logging'),
  
  DB_LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
    .description('Database logging level'),
  
  // Application Configuration
  APP_PORT: Joi.number()
    .port()
    .default(3000)
    .description('Application server port'),
  
  APP_HOST: Joi.string()
    .default('localhost')
    .description('Application server host'),
  
  // Health Check Configuration
  HEALTH_CHECK_INTERVAL: Joi.number()
    .integer()
    .min(1000)
    .default(30000)
    .description('Health check interval in milliseconds'),
  
  HEALTH_CHECK_TIMEOUT: Joi.number()
    .integer()
    .min(1000)
    .default(5000)
    .description('Health check timeout in milliseconds'),
  
}).unknown(true);

// Validate environment variables
const { error, value: env } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

// Export validated environment configuration
export const environment = {
  nodeEnv: env.NODE_ENV,
  
  // Database configuration
  database: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    
    // Connection pool settings
    pool: {
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
      acquire: env.DB_POOL_ACQUIRE_TIMEOUT,
      idle: env.DB_POOL_IDLE_TIMEOUT,
      evict: env.DB_POOL_EVICT_TIMEOUT,
    },
    
    // Connection settings
    connection: {
      timeout: env.DB_CONNECTION_TIMEOUT,
      commandTimeout: env.DB_COMMAND_TIMEOUT,
      retryAttempts: env.DB_RETRY_ATTEMPTS,
      retryDelay: env.DB_RETRY_DELAY,
    },
    
    // SSL settings
    ssl: {
      enabled: env.DB_SSL,
      ca: env.DB_SSL_CA,
      cert: env.DB_SSL_CERT,
      key: env.DB_SSL_KEY,
    },
    
    // Logging settings
    logging: {
      enabled: env.DB_LOGGING,
      level: env.DB_LOG_LEVEL,
    },
  },
  
  // Application configuration
  app: {
    port: env.APP_PORT,
    host: env.APP_HOST,
  },
  
  // Health check configuration
  healthCheck: {
    interval: env.HEALTH_CHECK_INTERVAL,
    timeout: env.HEALTH_CHECK_TIMEOUT,
  },
  
  // Utility methods
  isDevelopment: () => env.NODE_ENV === 'development',
  isProduction: () => env.NODE_ENV === 'production',
  isTest: () => env.NODE_ENV === 'test',
} as const;

// Type definitions for better TypeScript support
export type Environment = typeof environment;
export type DatabaseConfig = typeof environment.database;
export type PoolConfig = typeof environment.database.pool;
export type ConnectionConfig = typeof environment.database.connection;
export type SSLConfig = typeof environment.database.ssl;
export type LoggingConfig = typeof environment.database.logging;
export type AppConfig = typeof environment.app;
export type HealthCheckConfig = typeof environment.healthCheck;