/**
 * n8n API Integration Configuration
 * Configuration setup for n8n API integration with rate limiting, timeout, and retry logic
 */

import dotenv from 'dotenv';
import Joi from 'joi';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { N8nClientConfig, N8nRateLimitConfig, N8nRetryConfig, N8nErrorCode } from '../types/workflow';

// Load environment variables
dotenv.config();

// n8n Environment validation schema
const n8nEnvSchema = Joi.object({
  // n8n API Configuration
  N8N_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://172.16.30.60:5678')
    .description('n8n API base URL'),
  
  N8N_API_KEY: Joi.string()
    .required()
    .min(10)
    .description('n8n API key for authentication'),
  
  // Timeout Configuration
  N8N_TIMEOUT: Joi.number()
    .integer()
    .min(1000)
    .max(300000)
    .default(30000)
    .description('n8n API timeout in milliseconds'),
  
  // Rate Limiting Configuration
  N8N_RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(10)
    .description('Maximum requests per minute to n8n API'),
  
  // Retry Configuration
  N8N_RETRY_MAX_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(3)
    .description('Maximum retry attempts for failed requests'),
  
  N8N_RETRY_BASE_DELAY: Joi.number()
    .integer()
    .min(100)
    .max(10000)
    .default(1000)
    .description('Base delay between retries in milliseconds'),
  
  N8N_RETRY_MAX_DELAY: Joi.number()
    .integer()
    .min(1000)
    .max(60000)
    .default(30000)
    .description('Maximum delay between retries in milliseconds'),
  
  N8N_RETRY_EXPONENTIAL_BACKOFF: Joi.boolean()
    .default(true)
    .description('Enable exponential backoff for retries'),
  
  // Optional Configuration
  N8N_USER_AGENT: Joi.string()
    .default('NetworkCMDB-n8n-Client/1.0.0')
    .description('User agent for n8n API requests'),
  
  N8N_ENABLE_LOGGING: Joi.boolean()
    .default(false)
    .description('Enable detailed logging for n8n API calls'),
  
}).unknown(true);

// Validate n8n environment variables
const { error, value: n8nEnv } = n8nEnvSchema.validate(process.env);

if (error) {
  throw new Error(`n8n environment validation error: ${error.message}`);
}

// Rate limiting state
class RateLimiter {
  private requestTimes: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number = 60000; // 1 minute

  constructor(maxRequests: number) {
    this.maxRequests = maxRequests;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove requests older than the window
    this.requestTimes = this.requestTimes.filter(time => now - time < this.windowMs);
    return this.requestTimes.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requestTimes.push(Date.now());
  }

  getResetTime(): Date {
    if (this.requestTimes.length === 0) {
      return new Date();
    }
    // Reset time is when the oldest request becomes stale
    return new Date(this.requestTimes[0] + this.windowMs);
  }

  getCurrentRequests(): number {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(time => now - time < this.windowMs);
    return this.requestTimes.length;
  }
}

// Initialize rate limiter
const rateLimiter = new RateLimiter(n8nEnv.N8N_RATE_LIMIT_MAX_REQUESTS);

// Rate limiting configuration
const rateLimitConfig: N8nRateLimitConfig = {
  maxRequestsPerMinute: n8nEnv.N8N_RATE_LIMIT_MAX_REQUESTS,
  get currentRequests() {
    return rateLimiter.getCurrentRequests();
  },
  get resetTime() {
    return rateLimiter.getResetTime();
  },
  get retryAfter() {
    if (rateLimiter.canMakeRequest()) {
      return undefined;
    }
    const resetTime = rateLimiter.getResetTime();
    return Math.ceil((resetTime.getTime() - Date.now()) / 1000);
  }
};

// Retry configuration
const retryConfig: N8nRetryConfig = {
  maxAttempts: n8nEnv.N8N_RETRY_MAX_ATTEMPTS,
  baseDelay: n8nEnv.N8N_RETRY_BASE_DELAY,
  maxDelay: n8nEnv.N8N_RETRY_MAX_DELAY,
  exponentialBackoff: n8nEnv.N8N_RETRY_EXPONENTIAL_BACKOFF,
  retryOn: [
    'CONNECTION_ERROR',
    'TIMEOUT_ERROR',
    'RATE_LIMIT_EXCEEDED',
    'WORKFLOW_EXECUTION_ERROR',
    'NODE_EXECUTION_ERROR'
  ] as N8nErrorCode[]
};

// Main n8n configuration
export const n8nConfig: N8nClientConfig = {
  baseUrl: n8nEnv.N8N_BASE_URL,
  apiKey: n8nEnv.N8N_API_KEY,
  timeout: n8nEnv.N8N_TIMEOUT,
  rateLimit: rateLimitConfig,
  retry: retryConfig,
  userAgent: n8nEnv.N8N_USER_AGENT,
  headers: {
    'X-N8N-API-KEY': n8nEnv.N8N_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': n8nEnv.N8N_USER_AGENT,
  }
};

// Sleep utility for retries
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Calculate retry delay with exponential backoff
const calculateRetryDelay = (attempt: number): number => {
  if (!retryConfig.exponentialBackoff) {
    return retryConfig.baseDelay;
  }
  
  const delay = retryConfig.baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, retryConfig.maxDelay);
};

// Check if error should trigger retry
const shouldRetry = (error: any, attempt: number): boolean => {
  if (attempt >= retryConfig.maxAttempts) {
    return false;
  }
  
  // Check if error code is in retry list
  if (error?.response?.data?.error?.code) {
    return retryConfig.retryOn.includes(error.response.data.error.code);
  }
  
  // Retry on network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return true;
  }
  
  // Retry on 5xx server errors and 429 rate limit
  if (error?.response?.status) {
    const status = error.response.status;
    return status >= 500 || status === 429;
  }
  
  return false;
};

// Request interceptor for rate limiting
const requestInterceptor = async (config: AxiosRequestConfig): Promise<AxiosRequestConfig> => {
  // Check rate limit
  if (!rateLimiter.canMakeRequest()) {
    const retryAfter = rateLimitConfig.retryAfter || 60;
    await sleep(retryAfter * 1000);
  }
  
  // Record the request
  rateLimiter.recordRequest();
  
  // Add timestamp for logging
  config.metadata = { startTime: Date.now() };
  
  if (n8nEnv.N8N_ENABLE_LOGGING) {
    console.log(`[n8n] ${config.method?.toUpperCase()} ${config.url}`);
  }
  
  return config;
};

// Response interceptor for logging and error handling
const responseInterceptor = (response: AxiosResponse): AxiosResponse => {
  if (n8nEnv.N8N_ENABLE_LOGGING) {
    const duration = Date.now() - (response.config.metadata?.startTime || 0);
    console.log(`[n8n] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`);
  }
  return response;
};

// Error interceptor with retry logic
const errorInterceptor = async (error: any): Promise<any> => {
  const config = error.config;
  
  if (n8nEnv.N8N_ENABLE_LOGGING) {
    const duration = Date.now() - (config?.metadata?.startTime || 0);
    console.error(`[n8n] Error ${error.response?.status || 'NETWORK'} ${config?.method?.toUpperCase()} ${config?.url} (${duration}ms):`, error.message);
  }
  
  // Initialize retry count
  config._retryCount = config._retryCount || 0;
  
  // Check if we should retry
  if (shouldRetry(error, config._retryCount + 1)) {
    config._retryCount++;
    
    const delay = calculateRetryDelay(config._retryCount);
    
    if (n8nEnv.N8N_ENABLE_LOGGING) {
      console.log(`[n8n] Retrying request (attempt ${config._retryCount}/${retryConfig.maxAttempts}) after ${delay}ms`);
    }
    
    await sleep(delay);
    
    // Remove metadata to reset timing
    delete config.metadata;
    
    return n8nAxiosClient.request(config);
  }
  
  return Promise.reject(error);
};

// Create configured axios instance
export const n8nAxiosClient: AxiosInstance = axios.create({
  baseURL: n8nConfig.baseUrl,
  timeout: n8nConfig.timeout,
  headers: n8nConfig.headers,
});

// Add interceptors
n8nAxiosClient.interceptors.request.use(requestInterceptor);
n8nAxiosClient.interceptors.response.use(responseInterceptor, errorInterceptor);

// Utility functions
export const n8nUtils = {
  /**
   * Check if n8n API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await n8nAxiosClient.get('/healthz');
      return response.status === 200;
    } catch {
      return false;
    }
  },

  /**
   * Get current rate limit status
   */
  getRateLimitStatus() {
    return {
      maxRequests: rateLimitConfig.maxRequestsPerMinute,
      currentRequests: rateLimitConfig.currentRequests,
      resetTime: rateLimitConfig.resetTime,
      retryAfter: rateLimitConfig.retryAfter,
      canMakeRequest: rateLimiter.canMakeRequest()
    };
  },

  /**
   * Reset rate limiter (for testing)
   */
  resetRateLimit() {
    rateLimiter['requestTimes'] = [];
  },

  /**
   * Validate n8n API key format
   */
  validateApiKey(apiKey: string): boolean {
    return typeof apiKey === 'string' && apiKey.length >= 10;
  },

  /**
   * Build n8n API URL
   */
  buildApiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${n8nConfig.baseUrl}/api/v1${cleanPath}`;
  }
};

// Environment configuration export
export const n8nEnvironment = {
  baseUrl: n8nEnv.N8N_BASE_URL,
  timeout: n8nEnv.N8N_TIMEOUT,
  rateLimitMaxRequests: n8nEnv.N8N_RATE_LIMIT_MAX_REQUESTS,
  retryMaxAttempts: n8nEnv.N8N_RETRY_MAX_ATTEMPTS,
  retryBaseDelay: n8nEnv.N8N_RETRY_BASE_DELAY,
  retryMaxDelay: n8nEnv.N8N_RETRY_MAX_DELAY,
  exponentialBackoff: n8nEnv.N8N_RETRY_EXPONENTIAL_BACKOFF,
  userAgent: n8nEnv.N8N_USER_AGENT,
  loggingEnabled: n8nEnv.N8N_ENABLE_LOGGING,
  
  // Utility methods
  isConfigured: () => Boolean(n8nEnv.N8N_API_KEY),
  isValidUrl: () => {
    try {
      new URL(n8nEnv.N8N_BASE_URL);
      return true;
    } catch {
      return false;
    }
  }
} as const;

// Type exports for better TypeScript support
export type N8nEnvironment = typeof n8nEnvironment;
export type N8nUtils = typeof n8nUtils;

// Export the axios client as default
export default n8nAxiosClient;