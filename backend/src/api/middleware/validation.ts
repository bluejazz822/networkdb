/**
 * Validation Middleware
 * Express middleware for request validation using Joi schemas
 */

import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';

export interface ValidationConfig {
  body?: Schema;
  query?: Schema;
  params?: Schema;
}

/**
 * Create validation middleware for Express routes
 */
export function validateRequest(config: ValidationConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: any[] = [];

    // Validate request body
    if (config.body) {
      const { error } = config.body.validate(req.body);
      if (error) {
        errors.push({
          location: 'body',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      }
    }

    // Validate query parameters
    if (config.query) {
      const { error } = config.query.validate(req.query);
      if (error) {
        errors.push({
          location: 'query',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      }
    }

    // Validate route parameters
    if (config.params) {
      const { error } = config.params.validate(req.params);
      if (error) {
        errors.push({
          location: 'params',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    next();
  };
}

/**
 * Error handling middleware for API routes
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('API Error:', err);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: [{ message: err.message }]
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access',
      errors: [{ message: 'Authentication required' }]
    });
  }

  if (err.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable',
      errors: [{ message: 'Database connection failed' }]
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    errors: [{ 
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message 
    }]
  });
}

/**
 * Async route handler wrapper to catch errors
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}