/**
 * Connection Pool Configuration for Network CMDB
 * Optimized for 100K+ records and 50+ concurrent users
 * 
 * Performance targets:
 * - Search response time: <2 seconds
 * - Connection efficiency: >90%
 * - Support for high concurrency
 */

export interface PoolConfig {
  // Core pool settings
  min: number;
  max: number;
  acquire: number;
  idle: number;
  evict: number;
  
  // Performance optimization
  handleDisconnects: boolean;
  logging: boolean | ((sql: string, timing?: number) => void);
  benchmark: boolean;
  
  // Connection validation
  validate: () => Promise<boolean>;
  retry: {
    match: RegExp[];
    max: number;
  };
  
  // Monitoring hooks
  onConnectionAcquired?: (connection: any) => void;
  onConnectionReleased?: (connection: any) => void;
  onConnectionError?: (error: Error) => void;
}

/**
 * Production-optimized pool configuration for high-performance CMDB operations
 * Configured for 100K+ records and 50+ concurrent users
 */
export const productionPoolConfig: PoolConfig = {
  // Connection pool sizing for high concurrency
  min: 10,  // Maintain minimum connections for immediate availability
  max: 50,  // Support 50+ concurrent users with buffer
  
  // Timing configuration (milliseconds)
  acquire: 30000,  // 30 second timeout for connection acquisition
  idle: 60000,     // Close idle connections after 60 seconds
  evict: 120000,   // Check for idle connections every 2 minutes
  
  // Performance features
  handleDisconnects: true,  // Auto-reconnect on connection loss
  logging: false,           // Disable verbose SQL logging in production
  benchmark: false,         // Disable benchmarking in production
  
  // Connection validation for reliability
  validate: async (): Promise<boolean> => {
    // Basic connectivity check - to be enhanced after Stream B integration
    return true;
  },
  
  // Retry configuration for transient failures
  retry: {
    match: [
      /ETIMEDOUT/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /EHOSTUNREACH/,
      /ER_LOCK_WAIT_TIMEOUT/,
      /ER_LOCK_DEADLOCK/
    ],
    max: 3
  },
  
  // Monitoring hooks for performance tracking
  onConnectionAcquired: (connection: any) => {
    // Connection acquisition tracking - to be enhanced with db-monitor integration
  },
  
  onConnectionReleased: (connection: any) => {
    // Connection release tracking - to be enhanced with db-monitor integration
  },
  
  onConnectionError: (error: Error) => {
    // Error tracking and logging - to be enhanced with db-monitor integration
    console.error('Database connection error:', error);
  }
};

/**
 * Development pool configuration for local testing
 * Smaller pool size, more verbose logging
 */
export const developmentPoolConfig: PoolConfig = {
  min: 2,
  max: 10,
  acquire: 15000,
  idle: 30000,
  evict: 60000,
  handleDisconnects: true,
  logging: true,  // Enable SQL logging in development
  benchmark: true,  // Enable benchmarking in development
  
  validate: async (): Promise<boolean> => {
    return true;
  },
  
  retry: {
    match: [
      /ETIMEDOUT/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /EHOSTUNREACH/
    ],
    max: 2
  },
  
  onConnectionAcquired: (connection: any) => {
    console.log('Connection acquired from pool');
  },
  
  onConnectionReleased: (connection: any) => {
    console.log('Connection returned to pool');
  },
  
  onConnectionError: (error: Error) => {
    console.error('Development DB connection error:', error);
  }
};

/**
 * Test environment pool configuration
 * Minimal pool size, fast timeouts for quick test execution
 */
export const testPoolConfig: PoolConfig = {
  min: 1,
  max: 5,
  acquire: 5000,
  idle: 10000,
  evict: 30000,
  handleDisconnects: true,
  logging: false,
  benchmark: false,
  
  validate: async (): Promise<boolean> => {
    return true;
  },
  
  retry: {
    match: [/ETIMEDOUT/, /ECONNRESET/],
    max: 1
  }
};

/**
 * Pool configuration selector based on environment
 */
export const getPoolConfig = (environment: string = process.env.NODE_ENV || 'development'): PoolConfig => {
  switch (environment.toLowerCase()) {
    case 'production':
      return productionPoolConfig;
    case 'test':
      return testPoolConfig;
    case 'development':
    default:
      return developmentPoolConfig;
  }
};

/**
 * Performance thresholds and monitoring configuration
 */
export const performanceConfig = {
  // Query performance thresholds (milliseconds)
  slowQueryThreshold: 1000,      // Log queries taking longer than 1 second
  criticalQueryThreshold: 2000,  // Alert on queries taking longer than 2 seconds
  
  // Connection pool monitoring
  poolUtilizationThreshold: 0.8, // Alert when pool is 80% utilized
  connectionLeakThreshold: 300000, // Alert on connections held longer than 5 minutes
  
  // Performance targets
  targetResponseTime: 2000,       // Target <2 second response time
  maxConcurrentConnections: 50,   // Support 50+ concurrent users
  targetPoolEfficiency: 0.9,      // Target >90% pool efficiency
  
  // Monitoring intervals (milliseconds)
  metricsCollectionInterval: 30000,  // Collect metrics every 30 seconds
  performanceReportInterval: 300000, // Generate performance reports every 5 minutes
};

/**
 * Connection pool health check configuration
 */
export const healthCheckConfig = {
  enabled: true,
  interval: 60000,        // Check every minute
  timeout: 5000,          // 5 second timeout for health checks
  failureThreshold: 3,    // Mark unhealthy after 3 failures
  successThreshold: 2,    // Mark healthy after 2 successes
  
  // Health check queries
  pingQuery: 'SELECT 1 as health_check',
  performanceQuery: 'SELECT COUNT(*) as total_records FROM information_schema.tables',
};

export default {
  getPoolConfig,
  productionPoolConfig,
  developmentPoolConfig,
  testPoolConfig,
  performanceConfig,
  healthCheckConfig
};