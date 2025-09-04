import { Request, Response, NextFunction } from 'express';
import passport from 'passport';

/**
 * Authentication middleware for protecting routes
 * This provides the foundation for route protection that will be used throughout the application
 */

/**
 * Extended Request interface to include user information
 * This will be updated once the User model is available from Stream B
 */
export interface AuthenticatedRequest extends Request {
  user?: any; // Will be typed properly once User model is available
}

/**
 * Middleware to ensure user is authenticated
 * Redirects to login page if not authenticated (for web routes)
 * Returns 401 JSON response if not authenticated (for API routes)
 */
export const requireAuth = (options: { 
  redirectTo?: string; 
  apiRoute?: boolean;
} = {}) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }

    // Handle API routes with JSON response
    if (options.apiRoute || req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'UNAUTHORIZED'
      });
    }

    // Handle web routes with redirect
    const redirectTo = options.redirectTo || '/login';
    return res.redirect(redirectTo);
  };
};

/**
 * Middleware to ensure user is NOT authenticated
 * Useful for login/register pages where authenticated users should be redirected
 */
export const requireGuest = (redirectTo: string = '/dashboard') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return res.redirect(redirectTo);
    }
    next();
  };
};

/**
 * Middleware to optionally populate user information
 * Continues regardless of authentication status
 */
export const optionalAuth = () => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // User information will be available in req.user if authenticated
    // No action needed - just continue to next middleware
    next();
  };
};

/**
 * Role-based access control middleware
 * This is a placeholder that will be fully implemented in Stream F
 */
export const requireRole = (roles: string | string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'UNAUTHORIZED'
        });
      }
      return res.redirect('/login');
    }

    // TODO: Implement role checking once User/Role models are available from Stream B/F
    // const userRoles = req.user.roles || [];
    // const requiredRoles = Array.isArray(roles) ? roles : [roles];
    // const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    
    // For now, we'll log the role requirement and continue
    console.log(`Role requirement: ${Array.isArray(roles) ? roles.join(', ') : roles}`);
    console.log('Role-based access control will be implemented in Stream F');
    
    // TODO: Replace with actual role checking
    // if (!hasRequiredRole) {
    //   if (req.path.startsWith('/api/')) {
    //     return res.status(403).json({
    //       success: false,
    //       message: 'Insufficient permissions',
    //       error: 'FORBIDDEN'
    //     });
    //   }
    //   return res.status(403).render('error', { 
    //     message: 'Access denied', 
    //     error: { status: 403 } 
    //   });
    // }

    next();
  };
};

/**
 * Permission-based access control middleware
 * This is a placeholder that will be fully implemented in Stream F
 */
export const requirePermission = (permissions: string | string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'UNAUTHORIZED'
        });
      }
      return res.redirect('/login');
    }

    // TODO: Implement permission checking once User/Permission models are available
    console.log(`Permission requirement: ${Array.isArray(permissions) ? permissions.join(', ') : permissions}`);
    console.log('Permission-based access control will be implemented in Stream F');
    
    next();
  };
};

/**
 * Middleware to attach current user information to response locals
 * Makes user data available in templates and other middleware
 */
export const attachUser = () => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    res.locals.user = req.user || null;
    res.locals.isAuthenticated = req.isAuthenticated();
    next();
  };
};

/**
 * Login route middleware using Passport local strategy
 * This will be enhanced in Stream C with proper error handling and validation
 */
export const authenticateLocal = () => {
  return passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: false // Will be enabled with flash message support
  });
};

/**
 * API login middleware for JSON responses
 */
export const authenticateLocalAPI = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Authentication error',
          error: err.message
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: info?.message || 'Authentication failed',
          error: 'INVALID_CREDENTIALS'
        });
      }

      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Login error',
            error: err.message
          });
        }

        return res.json({
          success: true,
          message: 'Login successful',
          user: {
            id: user.id,
            email: user.email,
            // Add other safe user fields here
          }
        });
      });
    })(req, res, next);
  };
};

/**
 * Logout middleware
 */
export const logout = () => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      
      // Destroy session
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destruction error:', err);
          }
        });
      }
      
      // Clear session cookie
      res.clearCookie('network-cmdb-session');
      
      // For API routes, return JSON
      if (req.path.startsWith('/api/')) {
        return res.json({
          success: true,
          message: 'Logout successful'
        });
      }
      
      // For web routes, redirect to login
      res.redirect('/login');
    });
  };
};