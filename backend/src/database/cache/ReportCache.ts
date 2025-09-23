/**
 * Report Cache System
 *
 * Comprehensive caching layer for report data with configurable TTL,
 * cache invalidation strategies, and performance monitoring.
 * Supports both in-memory and Redis-based caching with intelligent
 * cache warming and memory-efficient storage patterns.
 */

import { EventEmitter } from 'events';
import { createClient, RedisClientType } from 'redis';
import crypto from 'crypto';
import winston from 'winston';
import { ReportingPoolMetrics, QueryExecutionMetrics } from '../connections/ReportingConnectionPool';

// Logger specifically for cache operations
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'ReportCache' }),
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

export interface CacheConfig {
  enabled: boolean;
  redisEnabled: boolean;
  defaultTtl: number;
  maxMemorySize: number;
  maxMemoryEntries: number;
  compressionThreshold: number;
  keyPrefix: string;
  maxKeyLength: number;
  performanceMonitoring: boolean;
  autoWarming: boolean;
  warmingQueries?: string[];
}

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  compressed: boolean;
  accessCount: number;
  lastAccessed: number;
  size: number;
  queryHash: string;
  metadata?: Record<string, any>;
}

export interface CacheStats {
  memoryCache: {
    entries: number;
    memoryUsage: number;
    hitRate: number;
    missRate: number;
    evictions: number;
  };
  redisCache: {
    entries: number;
    memoryUsage: string;
    hitRate: number;
    missRate: number;
    connectionStatus: string;
  };
  performance: {
    averageRetrievalTime: number;
    averageStorageTime: number;
    compressionRatio: number;
    totalRequests: number;
    cacheEfficiency: number;
  };
  invalidations: {
    manual: number;
    ttlExpired: number;
    memoryPressure: number;
    patternBased: number;
  };
}

export interface InvalidationRule {
  pattern: string;
  triggers: ('data_change' | 'time_based' | 'manual' | 'memory_pressure')[];
  priority: number;
  cascade: boolean;
}

export interface CacheWarming {
  enabled: boolean;
  queries: Array<{
    query: string;
    replacements?: Record<string, any>;
    ttl?: number;
    schedule?: string; // cron pattern
  }>;
  maxConcurrency: number;
  retryAttempts: number;
}

/**
 * Comprehensive Report Cache implementation with multi-tier caching,
 * intelligent invalidation, and performance monitoring
 */
export class ReportCache extends EventEmitter {
  private static instance: ReportCache;
  private redis: RedisClientType | null = null;
  private isRedisConnected = false;

  // In-memory cache with LRU eviction
  private memoryCache = new Map<string, CacheEntry>();
  private accessOrder = new Set<string>();

  // Configuration
  private config: CacheConfig;

  // Performance metrics
  private stats: CacheStats;
  private performanceHistory: Array<{
    operation: 'get' | 'set' | 'invalidate';
    duration: number;
    timestamp: number;
    cacheType: 'memory' | 'redis' | 'miss';
    keyPattern?: string;
  }> = [];

  // Invalidation rules
  private invalidationRules = new Map<string, InvalidationRule>();
  private scheduledInvalidations = new Map<string, NodeJS.Timeout>();

  // Cache warming
  private warmingConfig: CacheWarming = {
    enabled: false,
    queries: [],
    maxConcurrency: 3,
    retryAttempts: 2,
  };

  // Monitoring intervals
  private statsUpdateInterval: NodeJS.Timeout | null = null;
  private memoryCleanupInterval: NodeJS.Timeout | null = null;
  private warmingInterval: NodeJS.Timeout | null = null;

  private constructor(config?: Partial<CacheConfig>) {
    super();

    this.config = {
      enabled: process.env.REPORT_CACHE_ENABLED !== 'false',
      redisEnabled: process.env.REDIS_ENABLED !== 'false',
      defaultTtl: parseInt(process.env.REPORT_CACHE_TTL || '600'), // 10 minutes
      maxMemorySize: parseInt(process.env.REPORT_CACHE_MAX_MEMORY || '134217728'), // 128MB
      maxMemoryEntries: parseInt(process.env.REPORT_CACHE_MAX_ENTRIES || '10000'),
      compressionThreshold: parseInt(process.env.REPORT_CACHE_COMPRESSION_THRESHOLD || '8192'), // 8KB
      keyPrefix: 'report:',
      maxKeyLength: 250,
      performanceMonitoring: process.env.NODE_ENV !== 'production',
      autoWarming: process.env.REPORT_CACHE_AUTO_WARMING === 'true',
      ...config
    };

    this.stats = {
      memoryCache: {
        entries: 0,
        memoryUsage: 0,
        hitRate: 0,
        missRate: 0,
        evictions: 0,
      },
      redisCache: {
        entries: 0,
        memoryUsage: '0B',
        hitRate: 0,
        missRate: 0,
        connectionStatus: 'disconnected',
      },
      performance: {
        averageRetrievalTime: 0,
        averageStorageTime: 0,
        compressionRatio: 0,
        totalRequests: 0,
        cacheEfficiency: 0,
      },
      invalidations: {
        manual: 0,
        ttlExpired: 0,
        memoryPressure: 0,
        patternBased: 0,
      },
    };

    this.initializeDefaultInvalidationRules();
  }

  public static getInstance(config?: Partial<CacheConfig>): ReportCache {
    if (!ReportCache.instance) {
      ReportCache.instance = new ReportCache(config);
    }
    return ReportCache.instance;
  }

  /**
   * Initialize the cache system
   */
  public async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Report cache disabled, skipping initialization');
      return;
    }

    logger.info('Initializing report cache system...', {
      config: {
        redisEnabled: this.config.redisEnabled,
        defaultTtl: this.config.defaultTtl,
        maxMemorySize: this.config.maxMemorySize,
        autoWarming: this.config.autoWarming,
      },
    });

    try {
      // Initialize Redis if enabled
      if (this.config.redisEnabled) {
        await this.initializeRedis();
      }

      // Start monitoring and cleanup
      this.startStatsMonitoring();
      this.startMemoryCleanup();

      // Initialize cache warming if enabled
      if (this.config.autoWarming) {
        await this.initializeCacheWarming();
      }

      this.emit('cacheInitialized');
      logger.info('Report cache system initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize report cache system', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Retrieve data from cache with intelligent fallback
   */
  public async get(
    key: string,
    options?: {
      skipMemory?: boolean;
      skipRedis?: boolean;
      updateAccessTime?: boolean;
    }
  ): Promise<any | null> {
    if (!this.config.enabled) {
      return null;
    }

    const startTime = Date.now();
    const normalizedKey = this.normalizeKey(key);

    try {
      // Try memory cache first (fastest)
      if (!options?.skipMemory) {
        const memoryResult = this.getFromMemory(normalizedKey);
        if (memoryResult !== null) {
          this.recordPerformance('get', Date.now() - startTime, 'memory');
          this.updateStats('memory', 'hit');

          if (options?.updateAccessTime !== false) {
            this.updateAccessTime(normalizedKey);
          }

          logger.debug('Cache hit (memory)', { key: normalizedKey });
          return memoryResult;
        }
      }

      // Try Redis cache (secondary)
      if (this.config.redisEnabled && !options?.skipRedis && this.isRedisConnected) {
        const redisResult = await this.getFromRedis(normalizedKey);
        if (redisResult !== null) {
          // Store in memory for faster future access
          this.setInMemory(normalizedKey, redisResult, this.config.defaultTtl);

          this.recordPerformance('get', Date.now() - startTime, 'redis');
          this.updateStats('redis', 'hit');

          logger.debug('Cache hit (redis)', { key: normalizedKey });
          return redisResult;
        }
      }

      // Cache miss
      this.recordPerformance('get', Date.now() - startTime, 'miss');
      this.updateStats('memory', 'miss');

      logger.debug('Cache miss', { key: normalizedKey });
      return null;

    } catch (error) {
      logger.error('Cache get error', {
        key: normalizedKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Store data in cache with intelligent distribution
   */
  public async set(
    key: string,
    data: any,
    options?: {
      ttl?: number;
      skipMemory?: boolean;
      skipRedis?: boolean;
      compress?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const startTime = Date.now();
    const normalizedKey = this.normalizeKey(key);
    const ttl = options?.ttl || this.config.defaultTtl;

    try {
      // Store in memory cache
      if (!options?.skipMemory) {
        this.setInMemory(normalizedKey, data, ttl, options?.metadata);
      }

      // Store in Redis cache
      if (this.config.redisEnabled && !options?.skipRedis && this.isRedisConnected) {
        await this.setInRedis(normalizedKey, data, ttl, options?.compress, options?.metadata);
      }

      this.recordPerformance('set', Date.now() - startTime, 'memory');

      logger.debug('Cache set successful', {
        key: normalizedKey,
        ttl,
        memoryOnly: options?.skipRedis,
        redisOnly: options?.skipMemory,
      });

      this.emit('cacheSet', { key: normalizedKey, ttl, size: this.calculateSize(data) });

    } catch (error) {
      logger.error('Cache set error', {
        key: normalizedKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Invalidate cache entries by key or pattern
   */
  public async invalidate(
    keyOrPattern: string,
    options?: {
      cascade?: boolean;
      skipMemory?: boolean;
      skipRedis?: boolean;
      reason?: string;
    }
  ): Promise<number> {
    if (!this.config.enabled) {
      return 0;
    }

    const startTime = Date.now();
    let totalInvalidated = 0;

    try {
      // Determine if it's a pattern or exact key
      const isPattern = keyOrPattern.includes('*') || keyOrPattern.includes('?');

      if (isPattern) {
        // Pattern-based invalidation
        totalInvalidated = await this.invalidateByPattern(keyOrPattern, options);
        this.stats.invalidations.patternBased++;
      } else {
        // Exact key invalidation
        const normalizedKey = this.normalizeKey(keyOrPattern);
        totalInvalidated = await this.invalidateExact(normalizedKey, options);
        this.stats.invalidations.manual++;
      }

      this.recordPerformance('invalidate', Date.now() - startTime, 'memory');

      logger.info('Cache invalidation completed', {
        pattern: keyOrPattern,
        invalidated: totalInvalidated,
        reason: options?.reason || 'manual',
      });

      this.emit('cacheInvalidated', {
        pattern: keyOrPattern,
        count: totalInvalidated,
        reason: options?.reason || 'manual',
      });

      return totalInvalidated;

    } catch (error) {
      logger.error('Cache invalidation error', {
        pattern: keyOrPattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Warm cache with predefined queries
   */
  public async warmCache(
    queries: Array<{
      key: string;
      queryFn: () => Promise<any>;
      ttl?: number;
      priority?: number;
    }>
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    logger.info('Starting cache warming', { queryCount: queries.length });

    const sortedQueries = queries.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const chunks = this.chunkArray(sortedQueries, this.warmingConfig.maxConcurrency);

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(async ({ key, queryFn, ttl }) => {
          try {
            const data = await queryFn();
            await this.set(key, data, { ttl });
            logger.debug('Cache warmed', { key });
          } catch (error) {
            logger.warn('Cache warming failed for key', {
              key,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })
      );
    }

    logger.info('Cache warming completed');
    this.emit('cacheWarmed', { queryCount: queries.length });
  }

  /**
   * Get comprehensive cache statistics
   */
  public getStats(): CacheStats {
    this.updateCacheStats();
    return JSON.parse(JSON.stringify(this.stats));
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): {
    recentOperations: typeof this.performanceHistory;
    averagesByType: Record<string, { count: number; avgDuration: number }>;
    cacheHitRatio: number;
  } {
    const recentOperations = this.performanceHistory.slice(-1000);

    const averagesByType = recentOperations.reduce((acc, op) => {
      const key = `${op.operation}_${op.cacheType}`;
      if (!acc[key]) {
        acc[key] = { count: 0, totalDuration: 0, avgDuration: 0 };
      }
      acc[key].count++;
      acc[key].totalDuration += op.duration;
      acc[key].avgDuration = acc[key].totalDuration / acc[key].count;
      return acc;
    }, {} as Record<string, { count: number; totalDuration: number; avgDuration: number }>);

    const hits = recentOperations.filter(op => op.cacheType !== 'miss').length;
    const total = recentOperations.filter(op => op.operation === 'get').length;
    const cacheHitRatio = total > 0 ? hits / total : 0;

    return {
      recentOperations: recentOperations.slice(-100),
      averagesByType: Object.fromEntries(
        Object.entries(averagesByType).map(([key, value]) => [
          key,
          { count: value.count, avgDuration: value.avgDuration }
        ])
      ),
      cacheHitRatio,
    };
  }

  /**
   * Register invalidation rule
   */
  public registerInvalidationRule(name: string, rule: InvalidationRule): void {
    this.invalidationRules.set(name, rule);
    logger.debug('Invalidation rule registered', { name, rule });
  }

  /**
   * Trigger invalidation based on data change events
   */
  public async triggerInvalidation(
    trigger: 'data_change' | 'time_based' | 'manual' | 'memory_pressure',
    context?: Record<string, any>
  ): Promise<void> {
    const applicableRules = Array.from(this.invalidationRules.entries())
      .filter(([_, rule]) => rule.triggers.includes(trigger))
      .sort((a, b) => b[1].priority - a[1].priority);

    for (const [name, rule] of applicableRules) {
      try {
        const invalidated = await this.invalidate(rule.pattern, {
          cascade: rule.cascade,
          reason: `${trigger}:${name}`,
        });

        logger.debug('Rule-based invalidation completed', {
          rule: name,
          trigger,
          pattern: rule.pattern,
          invalidated,
        });
      } catch (error) {
        logger.error('Rule-based invalidation failed', {
          rule: name,
          trigger,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Clean up and close cache connections
   */
  public async close(): Promise<void> {
    logger.info('Closing report cache system...');

    this.stopStatsMonitoring();
    this.stopMemoryCleanup();
    this.stopCacheWarming();

    // Clear scheduled invalidations
    for (const timer of this.scheduledInvalidations.values()) {
      clearTimeout(timer);
    }
    this.scheduledInvalidations.clear();

    // Close Redis connection
    if (this.redis) {
      await this.redis.quit();
      this.isRedisConnected = false;
      this.redis = null;
    }

    // Clear memory cache
    this.memoryCache.clear();
    this.accessOrder.clear();

    this.emit('cacheClosed');
    logger.info('Report cache system closed');
  }

  // Private methods

  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = createClient({ url: redisUrl });

      this.redis.on('error', (err) => {
        logger.error('Redis error', { error: err.message });
        this.isRedisConnected = false;
        this.stats.redisCache.connectionStatus = 'error';
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected for report cache');
        this.isRedisConnected = true;
        this.stats.redisCache.connectionStatus = 'connected';
      });

      this.redis.on('ready', () => {
        this.isRedisConnected = true;
        this.stats.redisCache.connectionStatus = 'ready';
      });

      await this.redis.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis for report cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.config.redisEnabled = false;
    }
  }

  private normalizeKey(key: string): string {
    const fullKey = `${this.config.keyPrefix}${key}`;
    return fullKey.length > this.config.maxKeyLength
      ? fullKey.substring(0, this.config.maxKeyLength - 32) +
        crypto.createHash('md5').update(fullKey).digest('hex')
      : fullKey;
  }

  private getFromMemory(key: string): any | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    // Check TTL
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.memoryCache.delete(key);
      this.accessOrder.delete(key);
      this.stats.invalidations.ttlExpired++;
      return null;
    }

    return entry.compressed ? this.decompress(entry.data) : entry.data;
  }

  private setInMemory(
    key: string,
    data: any,
    ttl: number,
    metadata?: Record<string, any>
  ): void {
    // Check memory limits
    this.enforceMemoryLimits();

    const compressed = this.shouldCompress(data);
    const processedData = compressed ? this.compress(data) : data;
    const size = this.calculateSize(processedData);

    const entry: CacheEntry = {
      data: processedData,
      timestamp: Date.now(),
      ttl,
      compressed,
      accessCount: 1,
      lastAccessed: Date.now(),
      size,
      queryHash: crypto.createHash('md5').update(JSON.stringify(data)).digest('hex'),
      metadata,
    };

    this.memoryCache.set(key, entry);
    this.accessOrder.add(key);
  }

  private async getFromRedis(key: string): Promise<any | null> {
    if (!this.redis || !this.isRedisConnected) return null;

    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;

      const entry: CacheEntry = JSON.parse(cached);

      // Check TTL
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl * 1000) {
        await this.redis.del(key);
        this.stats.invalidations.ttlExpired++;
        return null;
      }

      return entry.compressed ? this.decompress(entry.data) : entry.data;
    } catch (error) {
      logger.debug('Redis get error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  private async setInRedis(
    key: string,
    data: any,
    ttl: number,
    forceCompress?: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.redis || !this.isRedisConnected) return;

    try {
      const compressed = forceCompress ?? this.shouldCompress(data);
      const processedData = compressed ? this.compress(data) : data;

      const entry: CacheEntry = {
        data: processedData,
        timestamp: Date.now(),
        ttl,
        compressed,
        accessCount: 1,
        lastAccessed: Date.now(),
        size: this.calculateSize(processedData),
        queryHash: crypto.createHash('md5').update(JSON.stringify(data)).digest('hex'),
        metadata,
      };

      await this.redis.setEx(key, ttl, JSON.stringify(entry));
    } catch (error) {
      logger.debug('Redis set error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async invalidateByPattern(
    pattern: string,
    options?: { skipMemory?: boolean; skipRedis?: boolean }
  ): Promise<number> {
    let totalInvalidated = 0;

    // Memory cache pattern invalidation
    if (!options?.skipMemory) {
      const regex = this.patternToRegex(pattern);
      const keysToDelete: string[] = [];

      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        this.memoryCache.delete(key);
        this.accessOrder.delete(key);
        totalInvalidated++;
      }
    }

    // Redis cache pattern invalidation
    if (this.config.redisEnabled && !options?.skipRedis && this.redis && this.isRedisConnected) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(keys);
          totalInvalidated += keys.length;
        }
      } catch (error) {
        logger.debug('Redis pattern invalidation error', {
          pattern,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return totalInvalidated;
  }

  private async invalidateExact(
    key: string,
    options?: { skipMemory?: boolean; skipRedis?: boolean }
  ): Promise<number> {
    let invalidated = 0;

    // Memory cache invalidation
    if (!options?.skipMemory && this.memoryCache.has(key)) {
      this.memoryCache.delete(key);
      this.accessOrder.delete(key);
      invalidated++;
    }

    // Redis cache invalidation
    if (this.config.redisEnabled && !options?.skipRedis && this.redis && this.isRedisConnected) {
      try {
        const deleted = await this.redis.del(key);
        invalidated += deleted;
      } catch (error) {
        logger.debug('Redis exact invalidation error', {
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return invalidated;
  }

  private shouldCompress(data: any): boolean {
    const size = this.calculateSize(data);
    return size > this.config.compressionThreshold;
  }

  private compress(data: any): string {
    // Simple JSON stringification for now
    // In production, you might want to use zlib or similar
    try {
      return JSON.stringify(data);
    } catch (error) {
      // Fallback for non-serializable data
      return String(data);
    }
  }

  private decompress(data: string): any {
    // Simple JSON parsing for now
    try {
      return JSON.parse(data);
    } catch (error) {
      // Return as string if parsing fails
      return data;
    }
  }

  private calculateSize(data: any): number {
    if (data === null || data === undefined) {
      return Buffer.byteLength('null', 'utf8');
    }
    try {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } catch (error) {
      // Fallback for non-serializable data
      return Buffer.byteLength(String(data), 'utf8');
    }
  }

  private updateAccessTime(key: string): void {
    const entry = this.memoryCache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      entry.accessCount++;

      // Update LRU order
      this.accessOrder.delete(key);
      this.accessOrder.add(key);
    }
  }

  private enforceMemoryLimits(): void {
    const currentMemory = this.getCurrentMemoryUsage();
    const currentEntries = this.memoryCache.size;

    if (currentMemory > this.config.maxMemorySize || currentEntries >= this.config.maxMemoryEntries) {
      this.performLRUEviction();
    }
  }

  private performLRUEviction(): void {
    const targetEvictions = Math.floor(this.memoryCache.size * 0.1); // Evict 10%
    let evicted = 0;

    for (const key of this.accessOrder) {
      if (evicted >= targetEvictions) break;

      this.memoryCache.delete(key);
      this.accessOrder.delete(key);
      evicted++;
      this.stats.memoryCache.evictions++;
      this.stats.invalidations.memoryPressure++;
    }

    logger.debug('LRU eviction completed', { evicted });
  }

  private getCurrentMemoryUsage(): number {
    let total = 0;
    for (const entry of this.memoryCache.values()) {
      total += entry.size;
    }
    return total;
  }

  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }

  private recordPerformance(
    operation: 'get' | 'set' | 'invalidate',
    duration: number,
    cacheType: 'memory' | 'redis' | 'miss'
  ): void {
    if (!this.config.performanceMonitoring) return;

    this.performanceHistory.push({
      operation,
      duration,
      timestamp: Date.now(),
      cacheType,
    });

    // Keep only recent history
    if (this.performanceHistory.length > 10000) {
      this.performanceHistory = this.performanceHistory.slice(-5000);
    }
  }

  private updateStats(cacheType: 'memory' | 'redis', result: 'hit' | 'miss'): void {
    const cache = this.stats[`${cacheType}Cache`];
    if (result === 'hit') {
      cache.hitRate = (cache.hitRate * 0.95) + (1 * 0.05); // Exponential moving average
    } else {
      cache.missRate = (cache.missRate * 0.95) + (1 * 0.05);
    }

    this.stats.performance.totalRequests++;
  }

  private updateCacheStats(): void {
    // Update memory cache stats
    this.stats.memoryCache.entries = this.memoryCache.size;
    this.stats.memoryCache.memoryUsage = this.getCurrentMemoryUsage();

    // Calculate cache efficiency
    const recentOps = this.performanceHistory.slice(-1000);
    const hits = recentOps.filter(op => op.cacheType !== 'miss').length;
    const total = recentOps.filter(op => op.operation === 'get').length;
    this.stats.performance.cacheEfficiency = total > 0 ? hits / total : 0;

    // Update average times
    const retrievals = recentOps.filter(op => op.operation === 'get');
    const storages = recentOps.filter(op => op.operation === 'set');

    this.stats.performance.averageRetrievalTime = retrievals.length > 0
      ? retrievals.reduce((sum, op) => sum + op.duration, 0) / retrievals.length
      : 0;

    this.stats.performance.averageStorageTime = storages.length > 0
      ? storages.reduce((sum, op) => sum + op.duration, 0) / storages.length
      : 0;
  }

  private initializeDefaultInvalidationRules(): void {
    // VPC data changes
    this.registerInvalidationRule('vpc_data', {
      pattern: `${this.config.keyPrefix}*vpc*`,
      triggers: ['data_change'],
      priority: 10,
      cascade: true,
    });

    // Subnet data changes
    this.registerInvalidationRule('subnet_data', {
      pattern: `${this.config.keyPrefix}*subnet*`,
      triggers: ['data_change'],
      priority: 8,
      cascade: true,
    });

    // Time-based invalidation for analytics
    this.registerInvalidationRule('analytics_refresh', {
      pattern: `${this.config.keyPrefix}*analytics*`,
      triggers: ['time_based'],
      priority: 5,
      cascade: false,
    });

    // Memory pressure cleanup
    this.registerInvalidationRule('memory_cleanup', {
      pattern: `${this.config.keyPrefix}*`,
      triggers: ['memory_pressure'],
      priority: 1,
      cascade: false,
    });
  }

  private async initializeCacheWarming(): Promise<void> {
    if (!this.warmingConfig.enabled) return;

    // Set up periodic cache warming
    this.warmingInterval = setInterval(async () => {
      try {
        await this.performScheduledWarming();
      } catch (error) {
        logger.error('Scheduled cache warming failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, 300000); // Every 5 minutes
  }

  private async performScheduledWarming(): Promise<void> {
    // This would be implemented based on your specific warming requirements
    logger.debug('Performing scheduled cache warming...');
    this.emit('cacheWarmingStarted');
  }

  private startStatsMonitoring(): void {
    this.statsUpdateInterval = setInterval(() => {
      this.updateCacheStats();
      this.emit('statsUpdated', this.getStats());
    }, 60000); // Update every minute
  }

  private stopStatsMonitoring(): void {
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
    }
  }

  private startMemoryCleanup(): void {
    this.memoryCleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 120000); // Cleanup every 2 minutes
  }

  private stopMemoryCleanup(): void {
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }
  }

  private stopCacheWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
    }
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
      this.accessOrder.delete(key);
      this.stats.invalidations.ttlExpired++;
    }

    if (keysToDelete.length > 0) {
      logger.debug('Cleaned up expired cache entries', { count: keysToDelete.length });
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// Export singleton instance
export const reportCache = ReportCache.getInstance();

// Convenience functions
export const initializeReportCache = async (config?: Partial<CacheConfig>): Promise<void> => {
  const instance = ReportCache.getInstance(config);
  return instance.initialize();
};

export const getCachedData = async (
  key: string,
  options?: Parameters<ReportCache['get']>[1]
): Promise<any | null> => {
  return reportCache.get(key, options);
};

export const setCachedData = async (
  key: string,
  data: any,
  options?: Parameters<ReportCache['set']>[2]
): Promise<void> => {
  return reportCache.set(key, data, options);
};

export const invalidateCachedData = async (
  keyOrPattern: string,
  options?: Parameters<ReportCache['invalidate']>[1]
): Promise<number> => {
  return reportCache.invalidate(keyOrPattern, options);
};

export const getCacheStats = (): CacheStats => {
  return reportCache.getStats();
};

export const warmReportCache = async (
  queries: Parameters<ReportCache['warmCache']>[0]
): Promise<void> => {
  return reportCache.warmCache(queries);
};

export const closeReportCache = async (): Promise<void> => {
  return reportCache.close();
};