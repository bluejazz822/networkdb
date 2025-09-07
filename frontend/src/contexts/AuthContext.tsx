import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { 
  AuthContextType, 
  User, 
  LoginRequest, 
  RegisterRequest, 
  UpdateProfileRequest, 
  ChangePasswordRequest 
} from '@/types/index';
import { authService } from '@/services/authService';

// Auth state interface
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Auth actions
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' };

// Initial state
const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Auth reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
        error: null,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    default:
      return state;
  }
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider props
interface AuthProviderProps {
  children: ReactNode;
}

// AuthProvider component
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Permission checking utilities
  const hasPermission = (permission: string): boolean => {
    if (!state.user || !state.isAuthenticated) return false;
    return state.user.permissions?.includes(permission) || false;
  };

  const hasRole = (roleName: string): boolean => {
    if (!state.user || !state.isAuthenticated) return false;
    return state.user.roles?.some(role => role.name === roleName) || false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!state.user || !state.isAuthenticated) return false;
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!state.user || !state.isAuthenticated) return false;
    return permissions.every(permission => hasPermission(permission));
  };

  // Login function
  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      const response = await authService.login(credentials);
      
      // Store token in localStorage
      localStorage.setItem('auth_token', response.data.token);
      
      if (response.data.refreshToken) {
        localStorage.setItem('refresh_token', response.data.refreshToken);
      }
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: response.data.user,
          token: response.data.token,
        },
      });
    } catch (error: any) {
      dispatch({
        type: 'SET_ERROR',
        payload: error.response?.data?.message || 'Login failed',
      });
      throw error;
    }
  };

  // Register function
  const register = async (userData: RegisterRequest): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      await authService.register(userData);
      
      // Optionally auto-login after registration
      // For now, just clear loading state
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error: any) {
      dispatch({
        type: 'SET_ERROR',
        payload: error.response?.data?.message || 'Registration failed',
      });
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    try {
      // Call logout API if token exists
      if (state.token) {
        authService.logout().catch(() => {
          // Ignore logout API errors - still clear local state
        });
      }
    } finally {
      // Clear local storage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      
      // Clear state
      dispatch({ type: 'LOGOUT' });
    }
  };

  // Refresh token function
  const refreshToken = async (): Promise<void> => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await authService.refreshToken(refreshToken);
      
      // Update tokens
      localStorage.setItem('auth_token', response.data.token);
      if (response.data.refreshToken) {
        localStorage.setItem('refresh_token', response.data.refreshToken);
      }
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: response.data.user,
          token: response.data.token,
        },
      });
    } catch (error) {
      // If refresh fails, logout user
      logout();
      throw error;
    }
  };

  // Update profile function
  const updateProfile = async (data: UpdateProfileRequest): Promise<void> => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      
      const response = await authService.updateProfile(data);
      
      dispatch({ type: 'UPDATE_USER', payload: response.data });
    } catch (error: any) {
      dispatch({
        type: 'SET_ERROR',
        payload: error.response?.data?.message || 'Profile update failed',
      });
      throw error;
    }
  };

  // Change password function
  const changePassword = async (data: ChangePasswordRequest): Promise<void> => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      
      await authService.changePassword(data);
    } catch (error: any) {
      dispatch({
        type: 'SET_ERROR',
        payload: error.response?.data?.message || 'Password change failed',
      });
      throw error;
    }
  };

  // Initialize authentication on app start
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('auth_token');
      
      if (token) {
        try {
          // Verify token and get user info
          const response = await authService.me();
          
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: {
              user: response.data,
              token,
            },
          });
        } catch (error) {
          // Token is invalid, clear it
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Context value
  const value: AuthContextType = {
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
    changePassword,
    hasPermission,
    hasRole,
    hasAnyPermission,
    hasAllPermissions,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// useAuth hook
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;