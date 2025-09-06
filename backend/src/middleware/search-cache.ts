/**
 * Search Cache Middleware
 * Redis-based caching for search results and auto-complete suggestions
 */

import { Request, Response, NextFunction } from 'express';
import { createClient, RedisClientType } from 'redis';
import crypto from 'crypto';
import { SearchQuery, AutoCompleteQuery, DEFAULT_SEARCH_CONFIG } from '../types/search';

interface CacheConfig {
  enabled: boolean;
  ttl: number;
  prefix: string;
  maxKeyLength: number;
  compressThreshold: number;
}

interface CachedResponse {
  data: any;
  timestamp: number;
  ttl: number;
  compressed?: boolean;
}

export class SearchCacheMiddleware {
  private redis: RedisClientType | null = null;
  private config: CacheConfig;
  private isConnected = false;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      enabled: process.env.REDIS_ENABLED !== 'false',
      ttl: DEFAULT_SEARCH_CONFIG.cacheTTL,
      prefix: 'search:',
      maxKeyLength: 200,
      compressThreshold: 1024,
      ...config
    };

    if (this.config.enabled) {
      this.initializeRedis();
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = createClient({ url: redisUrl });

      this.redis.on('error', (err) => {
        console.error('Redis error:', err);
        this.isConnected = false;
      });

      this.redis.on('connect', () => {
        console.log('Redis connected for search cache');
        this.isConnected = true;
      });

      this.redis.on('ready', () => {
        this.isConnected = true;
      });

      await this.redis.connect();
    } catch (error) {
      console.error('Failed to initialize Redis for search cache:', error);
      this.config.enabled = false;
    }
  }

  /**
   * Generate cache key from search parameters
   */
  private generateCacheKey(type: string, params: any): string {
    const normalized = this.normalizeParams(params);
    const hash = crypto.createHash('md5').update(JSON.stringify(normalized)).digest('hex');
    const key = `${this.config.prefix}${type}:${hash}`;
    
    return key.length > this.config.maxKeyLength 
      ? key.substring(0, this.config.maxKeyLength)
      : key;
  }

  /**
   * Normalize parameters for consistent caching
   */
  private normalizeParams(params: any): any {
    if (!params) return {};

    // Sort object keys for consistent serialization
    const sorted = {};
    Object.keys(params)
      .sort()
      .forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          if (typeof params[key] === 'object' && !Array.isArray(params[key])) {
            sorted[key] = this.normalizeParams(params[key]);
          } else {
            sorted[key] = params[key];
          }
        }
      });

    return sorted;
  }

  /**
   * Compress data if it exceeds threshold
   */
  private compressData(data: any): { data: string; compressed: boolean } {
    const serialized = JSON.stringify(data);
    
    if (serialized.length > this.config.compressThreshold) {
      // In a real implementation, you'd use zlib or similar
      // For simplicity, we'll just return the original data
      return { data: serialized, compressed: false };
    }
    
    return { data: serialized, compressed: false };
  }

  /**
   * Decompress data if needed
   */
  private decompressData(data: string, compressed: boolean): any {
    if (compressed) {
      // In a real implementation, you'd decompress here
      return JSON.parse(data);
    }
    
    return JSON.parse(data);
  }

  /**
   * Get cached result
   */
  private async getCached(key: string): Promise<any | null> {
    if (!this.config.enabled || !this.isConnected || !this.redis) {
      return null;
    }

    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;

      const cachedResponse: CachedResponse = JSON.parse(cached);
      
      // Check if cache has expired
      const now = Date.now();
      if (now - cachedResponse.timestamp > cachedResponse.ttl * 1000) {
        await this.redis.del(key);
        return null;
      }

      return this.decompressData(cachedResponse.data, cachedResponse.compressed || false);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached result
   */
  private async setCached(key: string, data: any, ttl?: number): Promise<void> {
    if (!this.config.enabled || !this.isConnected || !this.redis) {
      return;
    }

    try {
      const { data: compressedData, compressed } = this.compressData(data);
      const cachedResponse: CachedResponse = {
        data: compressedData,
        timestamp: Date.now(),
        ttl: ttl || this.config.ttl,
        compressed
      };

      await this.redis.setEx(
        key, 
        ttl || this.config.ttl, 
        JSON.stringify(cachedResponse)
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Cache middleware for search requests
   */
  public cacheSearch() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!this.config.enabled) {
        return next();
      }

      try {
        const { resourceType } = req.params;
        const searchQuery: SearchQuery = req.body;
        
        const cacheKey = this.generateCacheKey('search', {
          resourceType,
          query: searchQuery
        });

        // Try to get from cache
        const cached = await this.getCached(cacheKey);
        if (cached) {
          console.log(`Cache hit for search: ${cacheKey}`);
          return res.json({
            success: true,
            data: cached,
            cached: true
          });
        }

        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to cache the response
        res.json = function(data: any) {
          if (data.success && data.data) {
            // Cache successful responses only
            setImmediate(() => {
              SearchCacheMiddleware.prototype.setCached.call(
                req.app.locals.searchCache, 
                cacheKey, 
                data.data
              );
            });
          }
          return originalJson(data);
        };

        next();
      } catch (error) {
        console.error('Search cache middleware error:', error);
        next();
      }
    };
  }

  /**
   * Cache middleware for auto-complete requests
   */
  public cacheAutoComplete() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!this.config.enabled) {
        return next();
      }

      try {
        const autoCompleteQuery: AutoCompleteQuery = req.query as any;
        
        // Don't cache very short terms or empty queries
        if (!autoCompleteQuery.term || autoCompleteQuery.term.length < 2) {
          return next();
        }

        const cacheKey = this.generateCacheKey('autocomplete', autoCompleteQuery);

        // Try to get from cache
        const cached = await this.getCached(cacheKey);
        if (cached) {
          console.log(`Cache hit for auto-complete: ${cacheKey}`);
          return res.json({
            success: true,
            data: cached,
            cached: true
          });
        }

        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to cache the response
        res.json = function(data: any) {
          if (data.success && data.data) {
            // Use shorter TTL for auto-complete (more volatile)
            setImmediate(() => {
              SearchCacheMiddleware.prototype.setCached.call(
                req.app.locals.searchCache,
                cacheKey, 
                data.data,
                60 // 1 minute TTL for auto-complete
              );
            });
          }
          return originalJson(data);
        };

        next();
      } catch (error) {
        console.error('Auto-complete cache middleware error:', error);
        next();
      }
    };
  }

  /**
   * Cache middleware for popular terms (longer TTL)
   */
  public cachePopularTerms() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!this.config.enabled) {
        return next();
      }

      try {
        const { resourceType } = req.params;
        const limit = req.query.limit || 10;
        
        const cacheKey = this.generateCacheKey('popular', { resourceType, limit });

        // Try to get from cache
        const cached = await this.getCached(cacheKey);
        if (cached) {
          console.log(`Cache hit for popular terms: ${cacheKey}`);
          return res.json({
            success: true,
            data: cached,
            cached: true
          });
        }

        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to cache the response
        res.json = function(data: any) {
          if (data.success && data.data) {
            // Use longer TTL for popular terms (less volatile)
            setImmediate(() => {
              SearchCacheMiddleware.prototype.setCached.call(
                req.app.locals.searchCache,
                cacheKey, 
                data.data,
                3600 // 1 hour TTL for popular terms
              );
            });
          }
          return originalJson(data);
        };

        next();
      } catch (error) {
        console.error('Popular terms cache middleware error:', error);
        next();
      }
    };
  }

  /**
   * Invalidate cache for a resource type
   */
  public async invalidateResourceCache(resourceType: string): Promise<void> {
    if (!this.config.enabled || !this.isConnected || !this.redis) {
      return;
    }

    try {
      const pattern = `${this.config.prefix}*${resourceType}*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(keys);
        console.log(`Invalidated ${keys.length} cache entries for ${resourceType}`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Clear all search cache
   */
  public async clearCache(): Promise<void> {
    if (!this.config.enabled || !this.isConnected || !this.redis) {
      return;
    }

    try {
      const pattern = `${this.config.prefix}*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(keys);
        console.log(`Cleared ${keys.length} search cache entries`);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate: number;
  }> {
    if (!this.config.enabled || !this.isConnected || !this.redis) {
      return {
        totalKeys: 0,
        memoryUsage: '0B',
        hitRate: 0
      };
    }

    try {
      const pattern = `${this.config.prefix}*`;
      const keys = await this.redis.keys(pattern);
      
      // In a real implementation, you'd track hit/miss rates
      return {
        totalKeys: keys.length,
        memoryUsage: 'N/A', // Would require Redis INFO command
        hitRate: 0.75 // Mock data
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        totalKeys: 0,
        memoryUsage: '0B',
        hitRate: 0
      };
    }
  }

  /**
   * Close Redis connection
   */
  public async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
    }
  }
}

// Export default instance
export const searchCacheMiddleware = new SearchCacheMiddleware();

// Export middleware functions for easy use
export const cacheSearch = searchCacheMiddleware.cacheSearch.bind(searchCacheMiddleware);
export const cacheAutoComplete = searchCacheMiddleware.cacheAutoComplete.bind(searchCacheMiddleware);
export const cachePopularTerms = searchCacheMiddleware.cachePopularTerms.bind(searchCacheMiddleware);