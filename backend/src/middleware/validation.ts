import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { User, Role, Permission } from '../models';

/**
 * Validation middleware for authentication system data integrity
 */

// User validation schemas
export const userValidationSchemas = {
  create: Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(50)
      .required()
      .messages({
        'string.alphanum': 'Username can only contain letters and numbers',
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username cannot exceed 50 characters',
        'any.required': 'Username is required'
      }),
    email: Joi.string()
      .email()
      .min(5)
      .max(255)
      .required()
      .messages({
        'string.email': 'Must be a valid email address',
        'string.min': 'Email must be at least 5 characters long',
        'string.max': 'Email cannot exceed 255 characters',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password cannot exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      }),
    firstName: Joi.string()
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.min': 'First name cannot be empty',
        'string.max': 'First name cannot exceed 100 characters',
        'any.required': 'First name is required'
      }),
    lastName: Joi.string()
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.min': 'Last name cannot be empty',
        'string.max': 'Last name cannot exceed 100 characters',
        'any.required': 'Last name is required'
      }),
    isActive: Joi.boolean().default(true),
    isEmailVerified: Joi.boolean().default(false)
  }),

  update: Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(50)
      .messages({
        'string.alphanum': 'Username can only contain letters and numbers',
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username cannot exceed 50 characters'
      }),
    email: Joi.string()
      .email()
      .min(5)
      .max(255)
      .messages({
        'string.email': 'Must be a valid email address',
        'string.min': 'Email must be at least 5 characters long',
        'string.max': 'Email cannot exceed 255 characters'
      }),
    firstName: Joi.string()
      .min(1)
      .max(100)
      .messages({
        'string.min': 'First name cannot be empty',
        'string.max': 'First name cannot exceed 100 characters'
      }),
    lastName: Joi.string()
      .min(1)
      .max(100)
      .messages({
        'string.min': 'Last name cannot be empty',
        'string.max': 'Last name cannot exceed 100 characters'
      }),
    isActive: Joi.boolean(),
    isEmailVerified: Joi.boolean(),
    mfaEnabled: Joi.boolean()
  }).min(1), // At least one field must be provided

  changePassword: Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required'
    }),
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'New password must be at least 8 characters long',
        'string.max': 'New password cannot exceed 128 characters',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required'
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref('newPassword'))
      .required()
      .messages({
        'any.only': 'Password confirmation must match new password',
        'any.required': 'Password confirmation is required'
      })
  })
};

// Role validation schemas
export const roleValidationSchemas = {
  create: Joi.object({
    name: Joi.string()
      .pattern(/^[A-Z_]+$/)
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.pattern.base': 'Role name must be uppercase letters and underscores only (e.g., ADMIN, NETWORK_VIEWER)',
        'string.min': 'Role name must be at least 2 characters long',
        'string.max': 'Role name cannot exceed 50 characters',
        'any.required': 'Role name is required'
      }),
    displayName: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Display name must be at least 2 characters long',
        'string.max': 'Display name cannot exceed 100 characters',
        'any.required': 'Display name is required'
      }),
    description: Joi.string()
      .max(1000)
      .allow('', null)
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),
    priority: Joi.number()
      .integer()
      .min(0)
      .max(1000)
      .default(100)
      .messages({
        'number.integer': 'Priority must be an integer',
        'number.min': 'Priority cannot be negative',
        'number.max': 'Priority cannot exceed 1000'
      }),
    isActive: Joi.boolean().default(true)
  }),

  update: Joi.object({
    displayName: Joi.string()
      .min(2)
      .max(100)
      .messages({
        'string.min': 'Display name must be at least 2 characters long',
        'string.max': 'Display name cannot exceed 100 characters'
      }),
    description: Joi.string()
      .max(1000)
      .allow('', null)
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),
    priority: Joi.number()
      .integer()
      .min(0)
      .max(1000)
      .messages({
        'number.integer': 'Priority must be an integer',
        'number.min': 'Priority cannot be negative',
        'number.max': 'Priority cannot exceed 1000'
      }),
    isActive: Joi.boolean()
  }).min(1) // At least one field must be provided
};

// Permission validation schemas
export const permissionValidationSchemas = {
  create: Joi.object({
    name: Joi.string()
      .pattern(/^[a-z_]+:[a-z_]+$/)
      .min(3)
      .max(100)
      .messages({
        'string.pattern.base': 'Permission name must be in format "resource:action" with lowercase letters and underscores',
        'string.min': 'Permission name must be at least 3 characters long',
        'string.max': 'Permission name cannot exceed 100 characters'
      }),
    displayName: Joi.string()
      .min(3)
      .max(150)
      .required()
      .messages({
        'string.min': 'Display name must be at least 3 characters long',
        'string.max': 'Display name cannot exceed 150 characters',
        'any.required': 'Display name is required'
      }),
    description: Joi.string()
      .max(1000)
      .allow('', null)
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),
    resource: Joi.string()
      .pattern(/^[a-z_]+$/)
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.pattern.base': 'Resource must be lowercase letters and underscores only',
        'string.min': 'Resource must be at least 2 characters long',
        'string.max': 'Resource cannot exceed 50 characters',
        'any.required': 'Resource is required'
      }),
    action: Joi.string()
      .pattern(/^[a-z_]+$/)
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.pattern.base': 'Action must be lowercase letters and underscores only',
        'string.min': 'Action must be at least 2 characters long',
        'string.max': 'Action cannot exceed 50 characters',
        'any.required': 'Action is required'
      }),
    isActive: Joi.boolean().default(true)
  }),

  update: Joi.object({
    displayName: Joi.string()
      .min(3)
      .max(150)
      .messages({
        'string.min': 'Display name must be at least 3 characters long',
        'string.max': 'Display name cannot exceed 150 characters'
      }),
    description: Joi.string()
      .max(1000)
      .allow('', null)
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),
    isActive: Joi.boolean()
  }).min(1) // At least one field must be provided
};

/**
 * Generic validation middleware factory
 */
export function validateSchema(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorDetails
      });
    }

    req.body = value;
    next();
  };
}

/**
 * Validate unique constraints
 */
export const validateUniqueConstraints = {
  async username(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.body;
      const { id } = req.params;

      if (!username) {
        return next();
      }

      const existingUser = await User.findOne({
        where: { username },
        paranoid: false // Include soft-deleted users
      });

      if (existingUser && (!id || existingUser.id !== id)) {
        return res.status(409).json({
          success: false,
          error: 'Validation failed',
          details: [{
            field: 'username',
            message: 'Username already exists',
            value: username
          }]
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  async email(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const { id } = req.params;

      if (!email) {
        return next();
      }

      const existingUser = await User.findOne({
        where: { email: email.toLowerCase() },
        paranoid: false // Include soft-deleted users
      });

      if (existingUser && (!id || existingUser.id !== id)) {
        return res.status(409).json({
          success: false,
          error: 'Validation failed',
          details: [{
            field: 'email',
            message: 'Email already exists',
            value: email
          }]
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  async roleName(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;
      const { id } = req.params;

      if (!name) {
        return next();
      }

      const existingRole = await Role.findOne({
        where: { name },
        paranoid: false // Include soft-deleted roles
      });

      if (existingRole && (!id || existingRole.id !== id)) {
        return res.status(409).json({
          success: false,
          error: 'Validation failed',
          details: [{
            field: 'name',
            message: 'Role name already exists',
            value: name
          }]
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  async permissionName(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, resource, action } = req.body;
      const { id } = req.params;

      // Auto-generate name if not provided but resource and action are
      let permissionName = name;
      if (!permissionName && resource && action) {
        permissionName = `${resource}:${action}`;
        req.body.name = permissionName;
      }

      if (!permissionName) {
        return next();
      }

      const existingPermission = await Permission.findOne({
        where: { name: permissionName },
        paranoid: false // Include soft-deleted permissions
      });

      if (existingPermission && (!id || existingPermission.id !== id)) {
        return res.status(409).json({
          success: false,
          error: 'Validation failed',
          details: [{
            field: 'name',
            message: 'Permission name already exists',
            value: permissionName
          }]
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  }
};

/**
 * Validate system entity protection (prevent modification of system entities)
 */
export const validateSystemEntityProtection = {
  async role(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        return next();
      }

      const role = await Role.findByPk(id);
      if (!role) {
        return res.status(404).json({
          success: false,
          error: 'Role not found'
        });
      }

      if (role.isSystem && req.method !== 'GET') {
        return res.status(403).json({
          success: false,
          error: 'Cannot modify system role',
          details: [{
            field: 'id',
            message: `System role ${role.name} cannot be modified or deleted`,
            value: id
          }]
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  async permission(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        return next();
      }

      const permission = await Permission.findByPk(id);
      if (!permission) {
        return res.status(404).json({
          success: false,
          error: 'Permission not found'
        });
      }

      if (permission.isSystem && req.method !== 'GET') {
        return res.status(403).json({
          success: false,
          error: 'Cannot modify system permission',
          details: [{
            field: 'id',
            message: `System permission ${permission.name} cannot be modified or deleted`,
            value: id
          }]
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  }
};

/**
 * Sanitize and normalize input data
 */
export const sanitizeInput = {
  email(req: Request, res: Response, next: NextFunction) {
    if (req.body.email) {
      req.body.email = req.body.email.toLowerCase().trim();
    }
    next();
  },

  names(req: Request, res: Response, next: NextFunction) {
    ['firstName', 'lastName', 'displayName'].forEach(field => {
      if (req.body[field]) {
        req.body[field] = req.body[field].trim();
      }
    });
    next();
  },

  strings(req: Request, res: Response, next: NextFunction) {
    ['username', 'name', 'resource', 'action'].forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = req.body[field].trim();
      }
    });
    next();
  }
};

/**
 * Custom validation error handler
 */
export function handleValidationError(error: any, req: Request, res: Response, next: NextFunction) {
  if (error.name === 'SequelizeValidationError') {
    const errorDetails = error.errors.map((err: any) => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errorDetails
    });
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    const errorDetails = error.errors.map((err: any) => ({
      field: err.path,
      message: `${err.path} must be unique`,
      value: err.value
    }));

    return res.status(409).json({
      success: false,
      error: 'Unique constraint violation',
      details: errorDetails
    });
  }

  next(error);
}

/**
 * Combined validation middleware for different operations
 */
export const validationMiddleware = {
  createUser: [
    sanitizeInput.email,
    sanitizeInput.names,
    sanitizeInput.strings,
    validateSchema(userValidationSchemas.create),
    validateUniqueConstraints.username,
    validateUniqueConstraints.email
  ],

  updateUser: [
    sanitizeInput.email,
    sanitizeInput.names,
    sanitizeInput.strings,
    validateSchema(userValidationSchemas.update),
    validateUniqueConstraints.username,
    validateUniqueConstraints.email
  ],

  changePassword: [
    validateSchema(userValidationSchemas.changePassword)
  ],

  createRole: [
    sanitizeInput.names,
    sanitizeInput.strings,
    validateSchema(roleValidationSchemas.create),
    validateUniqueConstraints.roleName
  ],

  updateRole: [
    sanitizeInput.names,
    sanitizeInput.strings,
    validateSchema(roleValidationSchemas.update),
    validateUniqueConstraints.roleName,
    validateSystemEntityProtection.role
  ],

  deleteRole: [
    validateSystemEntityProtection.role
  ],

  createPermission: [
    sanitizeInput.names,
    sanitizeInput.strings,
    validateSchema(permissionValidationSchemas.create),
    validateUniqueConstraints.permissionName
  ],

  updatePermission: [
    sanitizeInput.names,
    sanitizeInput.strings,
    validateSchema(permissionValidationSchemas.update),
    validateUniqueConstraints.permissionName,
    validateSystemEntityProtection.permission
  ],

  deletePermission: [
    validateSystemEntityProtection.permission
  ]
};

export default validationMiddleware;