import session from 'express-session';
import { createClient } from 'redis';
import RedisStore from 'connect-redis';

/**
 * Session configuration for authentication
 * Supports both memory store (development) and Redis (production)
 */

let redisClient: any = null;

/**
 * Initialize Redis client for session storage
 * Falls back to memory store if Redis is not available
 */
const initializeRedisClient = async () => {
  try {
    if (process.env.REDIS_URL) {
      redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
          connectTimeout: 60000,
          lazyConnect: true
        }
      });

      redisClient.on('error', (err: any) => {
        console.warn('Redis client error:', err);
        console.warn('Falling back to memory store for sessions');
        redisClient = null;
      });

      redisClient.on('connect', () => {
        console.log('Connected to Redis for session storage');
      });

      redisClient.on('ready', () => {
        console.log('Redis client ready for session storage');
      });

      await redisClient.connect();
    } else {
      console.log('No Redis URL configured, using memory store for sessions');
    }
  } catch (error) {
    console.warn('Failed to connect to Redis:', error);
    console.warn('Falling back to memory store for sessions');
    redisClient = null;
  }
};

/**
 * Get session configuration object
 */
export const getSessionConfig = (): session.SessionOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const config: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'network-cmdb-session',
    cookie: {
      secure: isProduction, // Only send over HTTPS in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: isProduction ? 'strict' : 'lax' // CSRF protection
    },
    rolling: true // Reset expiration on activity
  };

  // Add Redis store if available
  if (redisClient) {
    config.store = new RedisStore({
      client: redisClient,
      prefix: 'session:',
      ttl: 24 * 60 * 60 // 24 hours in seconds
    });
  }

  return config;
};

/**
 * Initialize session configuration
 * Must be called before using sessions
 */
export const initializeSession = async () => {
  await initializeRedisClient();
  return getSessionConfig();
};

/**
 * Graceful shutdown for Redis connection
 */
export const closeSessionStore = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('Redis session store connection closed');
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
};

/**
 * Health check for session store
 */
export const checkSessionStoreHealth = async (): Promise<boolean> => {
  if (!redisClient) {
    return true; // Memory store is always "healthy"
  }

  try {
    await redisClient.ping();
    return true;
  } catch (error) {
    console.error('Session store health check failed:', error);
    return false;
  }
};

/**
 * Session middleware configuration for Express
 */
export const createSessionMiddleware = async () => {
  const config = await initializeSession();
  return session(config);
};