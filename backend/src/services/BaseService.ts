/**
 * Base Service Class
 * Provides common functionality for all service layer classes
 */

import { ValidationError } from 'joi';
import { NetworkValidationSchemas, BusinessRuleValidators } from '../schemas';
import { BaseRepository } from '../repositories/BaseRepository';

export interface ServiceError {
  code: string;
  message: string;
  details?: any;
  field?: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  errors?: ServiceError[];
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
}

export abstract class BaseService<TModel, TRepository extends BaseRepository<TModel>> {
  constructor(protected repository: TRepository) {}

  /**
   * Handle Joi validation errors
   */
  protected handleValidationError(error: ValidationError): ServiceError[] {
    return error.details.map(detail => ({
      code: 'VALIDATION_ERROR',
      message: detail.message,
      field: detail.path.join('.'),
      details: detail.context
    }));
  }

  /**
   * Create a success response
   */
  protected createSuccessResponse<T>(data: T, message?: string): ServiceResponse<T> {
    return {
      success: true,
      data,
      message
    };
  }

  /**
   * Create an error response
   */
  protected createErrorResponse(errors: ServiceError[], message?: string): ServiceResponse<any> {
    return {
      success: false,
      errors,
      message
    };
  }

  /**
   * Create a single error response
   */
  protected createSingleErrorResponse(
    code: string, 
    message: string, 
    field?: string,
    details?: any
  ): ServiceResponse<any> {
    return this.createErrorResponse([{ code, message, field, details }]);
  }

  /**
   * Handle database errors
   */
  protected handleDatabaseError(error: any): ServiceError[] {
    if (error.code === '23505') { // Unique constraint violation
      return [{
        code: 'DUPLICATE_RECORD',
        message: 'A record with this value already exists',
        details: error.detail
      }];
    }

    if (error.code === '23503') { // Foreign key constraint violation
      return [{
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Referenced record does not exist',
        details: error.detail
      }];
    }

    if (error.code === '23502') { // Not null violation
      return [{
        code: 'REQUIRED_FIELD_MISSING',
        message: 'Required field is missing',
        details: error.detail
      }];
    }

    return [{
      code: 'DATABASE_ERROR',
      message: 'An unexpected database error occurred',
      details: error.message
    }];
  }

  /**
   * Apply pagination to query options
   */
  protected applyPagination(options: QueryOptions): { page: number; limit: number; offset: number } {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Create paginated response
   */
  protected createPaginatedResponse<T>(
    data: T[],
    totalCount: number,
    page: number,
    limit: number
  ): PaginatedResponse<T> {
    return {
      data,
      totalCount,
      page,
      limit,
      hasNextPage: page * limit < totalCount,
      hasPrevPage: page > 1
    };
  }

  /**
   * Log service operations (can be extended for audit logging)
   */
  protected logOperation(
    operation: string,
    resourceType: string,
    resourceId?: string | number,
    userId?: string,
    metadata?: any
  ): void {
    console.log(`[${new Date().toISOString()}] ${operation}:${resourceType}`, {
      resourceId,
      userId,
      metadata
    });
  }

  /**
   * Abstract methods that must be implemented by subclasses
   */
  abstract create(data: any, userId?: string): Promise<ServiceResponse<TModel>>;
  abstract findById(id: string | number): Promise<ServiceResponse<TModel>>;
  abstract update(id: string | number, data: any, userId?: string): Promise<ServiceResponse<TModel>>;
  abstract delete(id: string | number, userId?: string): Promise<ServiceResponse<boolean>>;
  abstract findAll(options?: QueryOptions): Promise<ServiceResponse<PaginatedResponse<TModel>>>;
}