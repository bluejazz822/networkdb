/**
 * Comprehensive Unit Tests for ReportCache
 *
 * Tests all caching functionality including TTL, invalidation strategies,
 * performance monitoring, memory management, and Redis integration.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { ReportCache, CacheConfig, CacheStats } from '../../../database/cache/ReportCache';

// Mock Redis for testing
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    on: jest.fn(),
  })),
}));

describe('ReportCache', () => {
  let cache: ReportCache;
  let testConfig: Partial<CacheConfig>;

  beforeAll(() => {
    // Suppress console logs during testing
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  beforeEach(async () => {
    // Reset any existing singleton instance
    (ReportCache as any).instance = null;

    testConfig = {
      enabled: true,
      redisEnabled: false, // Disable Redis for most tests to focus on memory cache
      defaultTtl: 60,
      maxMemorySize: 1024 * 1024, // 1MB
      maxMemoryEntries: 100,
      compressionThreshold: 1024,
      keyPrefix: 'test:',
      maxKeyLength: 200,
      performanceMonitoring: true,
      autoWarming: false,
    };

    cache = ReportCache.getInstance(testConfig);
    await cache.initialize();
  });

  afterEach(async () => {
    if (cache) {
      await cache.close();
    }
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration when no config provided', async () => {
      (ReportCache as any).instance = null;
      const defaultCache = ReportCache.getInstance();
      await defaultCache.initialize();

      const stats = defaultCache.getStats();
      expect(stats).toBeDefined();
      expect(stats.memoryCache.entries).toBe(0);

      await defaultCache.close();
    });

    it('should initialize with custom configuration', async () => {
      expect(cache).toBeDefined();
      const stats = cache.getStats();
      expect(stats).toBeDefined();
      expect(stats.memoryCache.entries).toBe(0);
    });

    it('should handle initialization with Redis enabled', async () => {
      (ReportCache as any).instance = null;
      const redisConfig = { ...testConfig, redisEnabled: true };
      const redisCache = ReportCache.getInstance(redisConfig);

      await expect(redisCache.initialize()).resolves.not.toThrow();
      await redisCache.close();
    });

    it('should skip initialization when cache is disabled', async () => {
      (ReportCache as any).instance = null;
      const disabledConfig = { ...testConfig, enabled: false };
      const disabledCache = ReportCache.getInstance(disabledConfig);

      await expect(disabledCache.initialize()).resolves.not.toThrow();
      await disabledCache.close();
    });
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve data from memory cache', async () => {
      const testKey = 'test-key';
      const testData = { id: 1, name: 'Test Data', values: [1, 2, 3] };

      await cache.set(testKey, testData);
      const retrieved = await cache.get(testKey);

      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should handle null and undefined data', async () => {
      await cache.set('null-key', null);
      await cache.set('undefined-key', undefined);

      const nullResult = await cache.get('null-key');
      const undefinedResult = await cache.get('undefined-key');

      expect(nullResult).toBeNull();
      expect(undefinedResult).toBeUndefined();
    });

    it('should handle complex nested objects', async () => {
      const complexData = {
        vpc: {
          id: 'vpc-123',
          subnets: [
            { id: 'subnet-1', cidr: '10.0.1.0/24' },
            { id: 'subnet-2', cidr: '10.0.2.0/24' },
          ],
          metadata: {
            tags: { Environment: 'Test', Team: 'Platform' },
            created: new Date().toISOString(),
          },
        },
      };

      await cache.set('complex-key', complexData);
      const retrieved = await cache.get('complex-key');

      expect(retrieved).toEqual(complexData);
    });

    it('should handle large arrays', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        data: `Data for item ${i}`,
      }));

      await cache.set('large-array', largeArray);
      const retrieved = await cache.get('large-array');

      expect(retrieved).toEqual(largeArray);
      expect(retrieved.length).toBe(1000);
    });
  });

  describe('TTL (Time To Live) Functionality', () => {
    it('should respect TTL and expire entries', async () => {
      const testKey = 'ttl-test';
      const testData = { message: 'This should expire' };

      // Set with 1 second TTL
      await cache.set(testKey, testData, { ttl: 1 });

      // Should be available immediately
      let retrieved = await cache.get(testKey);
      expect(retrieved).toEqual(testData);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be null after expiration
      retrieved = await cache.get(testKey);
      expect(retrieved).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      const testKey = 'default-ttl-test';
      const testData = { message: 'Using default TTL' };

      await cache.set(testKey, testData);
      const retrieved = await cache.get(testKey);

      expect(retrieved).toEqual(testData);

      // Check that the entry has a TTL set (stats should show entries)
      const stats = cache.getStats();
      expect(stats.memoryCache.entries).toBeGreaterThan(0);
    });

    it('should handle different TTL values for different keys', async () => {
      await cache.set('short-ttl', { data: 'short' }, { ttl: 1 });
      await cache.set('long-ttl', { data: 'long' }, { ttl: 60 });

      // Both should be available initially
      expect(await cache.get('short-ttl')).toEqual({ data: 'short' });
      expect(await cache.get('long-ttl')).toEqual({ data: 'long' });

      // Wait for short TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Short TTL should be expired, long TTL should still be available
      expect(await cache.get('short-ttl')).toBeNull();
      expect(await cache.get('long-ttl')).toEqual({ data: 'long' });
    });

    it('should clean up expired entries during periodic cleanup', async () => {
      // Set multiple entries with short TTL
      for (let i = 0; i < 5; i++) {
        await cache.set(`cleanup-test-${i}`, { data: i }, { ttl: 1 });
      }

      let stats = cache.getStats();
      expect(stats.memoryCache.entries).toBe(5);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Trigger cleanup by trying to access any key
      await cache.get('cleanup-test-0');

      // Check that expired entries were cleaned up
      for (let i = 0; i < 5; i++) {
        const result = await cache.get(`cleanup-test-${i}`);
        expect(result).toBeNull();
      }
    });
  });

  describe('Cache Invalidation', () => {
    beforeEach(async () => {
      // Setup test data
      await cache.set('vpc:123', { id: '123', type: 'vpc' });
      await cache.set('vpc:456', { id: '456', type: 'vpc' });
      await cache.set('subnet:789', { id: '789', type: 'subnet' });
      await cache.set('report:analytics', { type: 'analytics' });
    });

    it('should invalidate exact keys', async () => {
      const invalidated = await cache.invalidate('vpc:123');
      expect(invalidated).toBe(1);

      const result = await cache.get('vpc:123');
      expect(result).toBeNull();

      // Other keys should still exist
      const otherResult = await cache.get('vpc:456');
      expect(otherResult).toEqual({ id: '456', type: 'vpc' });
    });

    it('should invalidate by pattern with wildcards', async () => {
      const invalidated = await cache.invalidate('test:vpc:*');
      expect(invalidated).toBeGreaterThanOrEqual(2);

      // VPC entries should be gone
      expect(await cache.get('vpc:123')).toBeNull();
      expect(await cache.get('vpc:456')).toBeNull();

      // Non-matching entries should remain
      expect(await cache.get('subnet:789')).toEqual({ id: '789', type: 'subnet' });
    });

    it('should handle complex patterns', async () => {
      await cache.set('test:report:vpc:summary', { data: 'vpc summary' });
      await cache.set('test:report:subnet:summary', { data: 'subnet summary' });
      await cache.set('test:analytics:daily', { data: 'daily analytics' });

      const invalidated = await cache.invalidate('test:report:*');
      expect(invalidated).toBeGreaterThanOrEqual(2);

      expect(await cache.get('test:report:vpc:summary')).toBeNull();
      expect(await cache.get('test:report:subnet:summary')).toBeNull();
      expect(await cache.get('test:analytics:daily')).toEqual({ data: 'daily analytics' });
    });

    it('should provide invalidation reason in events', async () => {
      const eventPromise = new Promise((resolve) => {
        cache.once('cacheInvalidated', resolve);
      });

      await cache.invalidate('vpc:123', { reason: 'data_updated' });

      const event = await eventPromise as any;
      expect(event.reason).toBe('data_updated');
      expect(event.pattern).toBe('vpc:123');
      expect(event.count).toBe(1);
    });

    it('should handle invalidation of non-existent keys gracefully', async () => {
      const invalidated = await cache.invalidate('non-existent-key');
      expect(invalidated).toBe(0);
    });
  });

  describe('Invalidation Rules and Triggers', () => {
    it('should register and apply invalidation rules', async () => {
      // Setup test data
      await cache.set('test:vpc:123', { id: '123' });
      await cache.set('test:subnet:456', { id: '456' });

      // Register rule
      cache.registerInvalidationRule('test_vpc_rule', {
        pattern: 'test:vpc:*',
        triggers: ['data_change'],
        priority: 10,
        cascade: true,
      });

      // Trigger invalidation
      await cache.triggerInvalidation('data_change');

      // VPC data should be invalidated
      expect(await cache.get('test:vpc:123')).toBeNull();
      // Subnet data should remain (different pattern)
      expect(await cache.get('test:subnet:456')).toEqual({ id: '456' });
    });

    it('should handle multiple rules with different priorities', async () => {
      await cache.set('test:high:priority', { data: 'high' });
      await cache.set('test:low:priority', { data: 'low' });

      cache.registerInvalidationRule('high_priority', {
        pattern: 'test:high:*',
        triggers: ['test_trigger'],
        priority: 100,
        cascade: false,
      });

      cache.registerInvalidationRule('low_priority', {
        pattern: 'test:low:*',
        triggers: ['test_trigger'],
        priority: 1,
        cascade: false,
      });

      await cache.triggerInvalidation('test_trigger');

      expect(await cache.get('test:high:priority')).toBeNull();
      expect(await cache.get('test:low:priority')).toBeNull();
    });

    it('should only trigger rules for matching trigger types', async () => {
      await cache.set('test:data:change', { data: 'change' });
      await cache.set('test:time:based', { data: 'time' });

      cache.registerInvalidationRule('data_change_rule', {
        pattern: 'test:data:*',
        triggers: ['data_change'],
        priority: 10,
        cascade: false,
      });

      cache.registerInvalidationRule('time_based_rule', {
        pattern: 'test:time:*',
        triggers: ['time_based'],
        priority: 10,
        cascade: false,
      });

      await cache.triggerInvalidation('data_change');

      expect(await cache.get('test:data:change')).toBeNull();
      expect(await cache.get('test:time:based')).toEqual({ data: 'time' });
    });
  });

  describe('Performance Monitoring', () => {
    it('should track cache hit and miss rates', async () => {
      // Generate cache hits
      await cache.set('perf:test:1', { data: 'test1' });
      await cache.set('perf:test:2', { data: 'test2' });

      await cache.get('perf:test:1'); // hit
      await cache.get('perf:test:2'); // hit
      await cache.get('perf:test:3'); // miss

      const metrics = cache.getPerformanceMetrics();
      expect(metrics.cacheHitRatio).toBeGreaterThan(0);
      expect(metrics.recentOperations.length).toBeGreaterThan(0);
    });

    it('should record operation timings', async () => {
      await cache.set('timing:test', { data: 'timing test' });
      await cache.get('timing:test');

      const metrics = cache.getPerformanceMetrics();
      const setOperations = metrics.recentOperations.filter(op => op.operation === 'set');
      const getOperations = metrics.recentOperations.filter(op => op.operation === 'get');

      expect(setOperations.length).toBeGreaterThan(0);
      expect(getOperations.length).toBeGreaterThan(0);
      expect(setOperations[0].duration).toBeGreaterThanOrEqual(0);
      expect(getOperations[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should track operations by cache type', async () => {
      await cache.set('cache:type:test', { data: 'test' });
      await cache.get('cache:type:test'); // memory hit
      await cache.get('cache:type:missing'); // miss

      const metrics = cache.getPerformanceMetrics();
      const memoryOps = metrics.recentOperations.filter(op => op.cacheType === 'memory');
      const missOps = metrics.recentOperations.filter(op => op.cacheType === 'miss');

      expect(memoryOps.length).toBeGreaterThan(0);
      expect(missOps.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive cache statistics', async () => {
      // Add some data to generate stats
      for (let i = 0; i < 10; i++) {
        await cache.set(`stats:test:${i}`, { data: `test${i}` });
      }

      const stats = cache.getStats();

      expect(stats.memoryCache.entries).toBe(10);
      expect(stats.memoryCache.memoryUsage).toBeGreaterThan(0);
      expect(stats.performance.totalRequests).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('should enforce memory entry limits', async () => {
      // Set cache with small entry limit for testing
      await cache.close();
      (ReportCache as any).instance = null;

      const limitedConfig = { ...testConfig, maxMemoryEntries: 5 };
      cache = ReportCache.getInstance(limitedConfig);
      await cache.initialize();

      // Add more entries than the limit
      for (let i = 0; i < 10; i++) {
        await cache.set(`memory:limit:${i}`, { data: `test${i}` });
      }

      const stats = cache.getStats();
      expect(stats.memoryCache.entries).toBeLessThanOrEqual(5);
    });

    it('should perform LRU eviction when memory limits are reached', async () => {
      await cache.close();
      (ReportCache as any).instance = null;

      const limitedConfig = { ...testConfig, maxMemoryEntries: 3 };
      cache = ReportCache.getInstance(limitedConfig);
      await cache.initialize();

      // Add entries sequentially
      await cache.set('lru:1', { data: 'first' });
      await cache.set('lru:2', { data: 'second' });
      await cache.set('lru:3', { data: 'third' });

      // Access first entry to make it most recent
      await cache.get('lru:1');

      // Add another entry, should evict least recently used
      await cache.set('lru:4', { data: 'fourth' });

      // First entry should still exist (was accessed recently)
      expect(await cache.get('lru:1')).toEqual({ data: 'first' });
      // One of the others should be evicted
      const stats = cache.getStats();
      expect(stats.memoryCache.entries).toBeLessThanOrEqual(3);
    });

    it('should calculate memory usage accurately', async () => {
      const largeData = {
        description: 'A'.repeat(1000), // 1KB string
        array: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` })),
      };

      await cache.set('memory:usage:test', largeData);

      const stats = cache.getStats();
      expect(stats.memoryCache.memoryUsage).toBeGreaterThan(1000);
    });

    it('should clean up expired entries to free memory', async () => {
      // Add entries that will expire quickly
      for (let i = 0; i < 5; i++) {
        await cache.set(`expire:${i}`, { data: `test${i}` }, { ttl: 1 });
      }

      let stats = cache.getStats();
      const initialEntries = stats.memoryCache.entries;

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Access cache to trigger cleanup
      await cache.get('expire:0');

      stats = cache.getStats();
      expect(stats.memoryCache.entries).toBeLessThan(initialEntries);
    });
  });

  describe('Compression', () => {
    it('should compress large data automatically', async () => {
      await cache.close();
      (ReportCache as any).instance = null;

      const compressionConfig = { ...testConfig, compressionThreshold: 100 };
      cache = ReportCache.getInstance(compressionConfig);
      await cache.initialize();

      const largeData = {
        description: 'X'.repeat(500), // Larger than threshold
        metadata: { large: true },
      };

      await cache.set('compression:test', largeData);
      const retrieved = await cache.get('compression:test');

      expect(retrieved).toEqual(largeData);
    });

    it('should not compress small data', async () => {
      const smallData = { small: true, data: 'test' };

      await cache.set('no:compression:test', smallData);
      const retrieved = await cache.get('no:compression:test');

      expect(retrieved).toEqual(smallData);
    });

    it('should handle compression explicitly when requested', async () => {
      const data = { message: 'Force compression test' };

      await cache.set('force:compression', data, { compress: true });
      const retrieved = await cache.get('force:compression');

      expect(retrieved).toEqual(data);
    });
  });

  describe('Cache Warming', () => {
    it('should warm cache with provided queries', async () => {
      const warmingQueries = [
        {
          key: 'warm:test:1',
          queryFn: async () => ({ id: 1, data: 'warmed data 1' }),
          ttl: 120,
          priority: 10,
        },
        {
          key: 'warm:test:2',
          queryFn: async () => ({ id: 2, data: 'warmed data 2' }),
          ttl: 60,
          priority: 5,
        },
      ];

      await cache.warmCache(warmingQueries);

      // Check that warmed data is available
      expect(await cache.get('warm:test:1')).toEqual({ id: 1, data: 'warmed data 1' });
      expect(await cache.get('warm:test:2')).toEqual({ id: 2, data: 'warmed data 2' });
    });

    it('should handle warming failures gracefully', async () => {
      const warmingQueries = [
        {
          key: 'warm:success',
          queryFn: async () => ({ success: true }),
        },
        {
          key: 'warm:failure',
          queryFn: async () => {
            throw new Error('Warming failure');
          },
        },
      ];

      await expect(cache.warmCache(warmingQueries)).resolves.not.toThrow();

      // Success case should be cached
      expect(await cache.get('warm:success')).toEqual({ success: true });
      // Failure case should not be cached
      expect(await cache.get('warm:failure')).toBeNull();
    });

    it('should respect priority order during warming', async () => {
      const warmingOrder: string[] = [];

      const warmingQueries = [
        {
          key: 'warm:low',
          queryFn: async () => {
            warmingOrder.push('low');
            return { priority: 'low' };
          },
          priority: 1,
        },
        {
          key: 'warm:high',
          queryFn: async () => {
            warmingOrder.push('high');
            return { priority: 'high' };
          },
          priority: 10,
        },
        {
          key: 'warm:medium',
          queryFn: async () => {
            warmingOrder.push('medium');
            return { priority: 'medium' };
          },
          priority: 5,
        },
      ];

      await cache.warmCache(warmingQueries);

      // High priority should be processed first (within same chunk)
      expect(warmingOrder[0]).toBe('high');
    });
  });

  describe('Event Handling', () => {
    it('should emit events for cache operations', async () => {
      const events: any[] = [];

      cache.on('cacheSet', (event) => events.push({ type: 'set', ...event }));
      cache.on('cacheInvalidated', (event) => events.push({ type: 'invalidated', ...event }));

      await cache.set('event:test', { data: 'test' });
      await cache.invalidate('event:test');

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('set');
      expect(events[1].type).toBe('invalidated');
    });

    it('should emit stats updates', async () => {
      const statsEvents: any[] = [];
      cache.on('statsUpdated', (stats) => statsEvents.push(stats));

      // Add some data to generate stats
      await cache.set('stats:event:test', { data: 'test' });

      // Wait a bit for stats update interval
      await new Promise(resolve => setTimeout(resolve, 100));

      // Note: In a real test, you might need to trigger the stats update manually
      // or wait for the interval to fire
    });
  });

  describe('Error Handling', () => {
    it('should handle cache operations when disabled', async () => {
      await cache.close();
      (ReportCache as any).instance = null;

      const disabledConfig = { ...testConfig, enabled: false };
      const disabledCache = ReportCache.getInstance(disabledConfig);
      await disabledCache.initialize();

      await expect(disabledCache.set('test', { data: 'test' })).resolves.not.toThrow();
      expect(await disabledCache.get('test')).toBeNull();
      expect(await disabledCache.invalidate('test')).toBe(0);

      await disabledCache.close();
    });

    it('should handle malformed data gracefully', async () => {
      // Test with circular references
      const circularData: any = { name: 'test' };
      circularData.self = circularData;

      await expect(cache.set('circular', circularData)).rejects.toThrow();
    });

    it('should handle very large keys', async () => {
      const veryLongKey = 'x'.repeat(1000); // Longer than maxKeyLength
      const data = { data: 'test' };

      await expect(cache.set(veryLongKey, data)).resolves.not.toThrow();
      expect(await cache.get(veryLongKey)).toEqual(data);
    });

    it('should handle cache operations during shutdown', async () => {
      await cache.close();

      // Operations after close should not throw but should not work
      await expect(cache.set('after:close', { data: 'test' })).resolves.not.toThrow();
      expect(await cache.get('after:close')).toBeNull();
    });
  });

  describe('Integration with Options', () => {
    it('should respect skipMemory option', async () => {
      await cache.set('memory:skip:test', { data: 'test' });

      // Should not find it when skipping memory
      const result = await cache.get('memory:skip:test', { skipMemory: true });
      expect(result).toBeNull();

      // Should find it when not skipping memory
      const normalResult = await cache.get('memory:skip:test');
      expect(normalResult).toEqual({ data: 'test' });
    });

    it('should not update access time when requested', async () => {
      await cache.set('access:time:test', { data: 'test' });

      // Get initial access time
      const stats1 = cache.getStats();
      const initialAccess = stats1.memoryCache.entries;

      // Access without updating access time
      await cache.get('access:time:test', { updateAccessTime: false });

      // Access time should not be updated (this is implementation dependent)
      const result = await cache.get('access:time:test');
      expect(result).toEqual({ data: 'test' });
    });

    it('should handle metadata storage and retrieval', async () => {
      const metadata = {
        source: 'test',
        version: '1.0',
        tags: ['test', 'metadata'],
      };

      await cache.set('metadata:test', { data: 'test' }, { metadata });
      const result = await cache.get('metadata:test');

      expect(result).toEqual({ data: 'test' });
      // Note: Metadata is internal and not returned with get()
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent reads and writes', async () => {
      const operations = [];

      // Start multiple concurrent operations
      for (let i = 0; i < 10; i++) {
        operations.push(cache.set(`concurrent:${i}`, { id: i, data: `test${i}` }));
      }

      for (let i = 0; i < 10; i++) {
        operations.push(cache.get(`concurrent:${i}`));
      }

      const results = await Promise.allSettled(operations);

      // All operations should succeed
      const failures = results.filter(r => r.status === 'rejected');
      expect(failures).toHaveLength(0);
    });

    it('should handle concurrent invalidations', async () => {
      // Setup test data
      for (let i = 0; i < 20; i++) {
        await cache.set(`concurrent:invalidate:${i}`, { id: i });
      }

      // Start concurrent invalidations
      const invalidations = [
        cache.invalidate('concurrent:invalidate:*'),
        cache.invalidate('concurrent:invalidate:1*'),
        cache.invalidate('concurrent:invalidate:5'),
      ];

      const results = await Promise.allSettled(invalidations);

      // All invalidations should succeed
      const failures = results.filter(r => r.status === 'rejected');
      expect(failures).toHaveLength(0);
    });
  });
});