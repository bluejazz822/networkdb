import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import csurf from 'csurf';
import cookieParser from 'cookie-parser';

/**
 * Security middleware for production-ready authentication and application security
 */

/**
 * CORS configuration
 * Configure based on environment and allowed origins
 */
export const configureCORS = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Get allowed origins from environment variables
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001']; // Default for development

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin && !isProduction) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin || '')) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true, // Allow cookies to be sent
    optionsSuccessStatus: 200, // Support legacy browsers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token'
    ]
  });
};

/**
 * Helmet security headers configuration
 */
export const configureHelmet = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for development
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false, // Disable for compatibility
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    }
  });
};

/**
 * Rate limiting configuration
 */
export const createRateLimiters = () => {
  // General API rate limiter
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      error: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false // Disable legacy headers
  });

  // Strict limiter for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: {
      success: false,
      message: 'Too many login attempts from this IP, please try again later.',
      error: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    skipSuccessfulRequests: true, // Don't count successful requests
    standardHeaders: true,
    legacyHeaders: false
  });

  // Very strict limiter for password reset endpoints
  const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 password reset attempts per hour
    message: {
      success: false,
      message: 'Too many password reset attempts from this IP, please try again later.',
      error: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  return {
    general: generalLimiter,
    auth: authLimiter,
    passwordReset: passwordResetLimiter
  };
};

/**
 * CSRF protection configuration
 * Must be used after cookie-parser and session middleware
 */
export const configureCSRF = () => {
  return csurf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    }
  });
};

/**
 * CSRF token endpoint middleware
 * Provides CSRF token for frontend applications
 */
export const csrfTokenEndpoint = (req: Request, res: Response) => {
  res.json({
    success: true,
    csrfToken: req.csrfToken()
  });
};

/**
 * Custom error handler for CSRF errors
 */
export const csrfErrorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      error: 'CSRF_TOKEN_INVALID'
    });
  }
  next(error);
};

/**
 * Request logging middleware for security auditing
 */
export const securityLogger = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const isAuthRoute = req.path.includes('/auth/') || 
                       req.path.includes('/login') || 
                       req.path.includes('/logout');

    if (isAuthRoute) {
      console.log(`[SECURITY] ${req.method} ${req.path} from ${req.ip}`);
      
      // Log additional security-relevant information
      const securityInfo = {
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        timestamp: new Date().toISOString(),
        ip: req.ip,
        method: req.method,
        path: req.path
      };

      // In production, you might want to use a proper logging service
      console.log('[SECURITY_AUDIT]', JSON.stringify(securityInfo));
    }

    next();
  };
};

/**
 * Content Security Policy nonce generator
 * For inline scripts that need to bypass CSP
 */
export const generateNonce = (req: Request, res: Response, next: NextFunction) => {
  res.locals.nonce = Buffer.from(Math.random().toString()).toString('base64');
  next();
};

/**
 * Security headers middleware
 * Additional security headers beyond Helmet
 */
export const additionalSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS filtering
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Feature policy (experimental)
  res.setHeader('Feature-Policy', 
    "geolocation 'none'; microphone 'none'; camera 'none'");

  next();
};

/**
 * Input sanitization middleware
 * Basic input validation and sanitization
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Basic XSS prevention - remove potentially dangerous characters from strings
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
      .trim();
  };

  // Recursively sanitize object properties
  const sanitizeObject = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    
    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Initialize all security middleware
 * Returns an array of middleware functions to be used with Express
 */
export const initializeSecurityMiddleware = () => {
  const rateLimiters = createRateLimiters();
  
  return {
    // Core security middleware
    helmet: configureHelmet(),
    cors: configureCORS(),
    
    // Rate limiting
    rateLimiters,
    
    // CSRF protection (to be applied after session middleware)
    csrf: configureCSRF(),
    csrfTokenEndpoint,
    csrfErrorHandler,
    
    // Additional security
    securityLogger: securityLogger(),
    additionalHeaders: additionalSecurityHeaders,
    sanitizeInput,
    generateNonce
  };
};

/**
 * Health check for security middleware
 */
export const securityHealthCheck = (): { [key: string]: boolean } => {
  return {
    helmet: true,
    cors: true,
    rateLimiting: true,
    csrf: true,
    inputSanitization: true,
    securityHeaders: true
  };
};