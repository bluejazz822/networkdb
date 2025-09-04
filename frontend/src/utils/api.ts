import axios from 'axios'
import type { ApiResponse } from '@/types/index'

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add authentication token if available
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // Log requests in development
    if (import.meta.env.VITE_ENABLE_DEBUG === 'true') {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data)
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor with token refresh logic
api.interceptors.response.use(
  (response) => {
    // Log responses in development
    if (import.meta.env.VITE_ENABLE_DEBUG === 'true') {
      console.log(`API Response: ${response.status}`, response.data)
    }
    
    return response
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors with token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken && !originalRequest.url?.includes('/auth/refresh')) {
        try {
          // Attempt to refresh the token
          const refreshResponse = await api.post('/auth/refresh', { refreshToken });
          const { token } = refreshResponse.data.data;
          
          // Update stored token
          localStorage.setItem('auth_token', token);
          
          // Update the authorization header for the original request
          originalRequest.headers.Authorization = `Bearer ${token}`;
          
          // Retry the original request
          return api.request(originalRequest);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          
          // Only redirect if not already on auth pages
          if (!window.location.pathname.startsWith('/auth/')) {
            window.location.href = '/auth/login';
          }
          
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token or already trying to refresh, redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        
        // Only redirect if not already on auth pages
        if (!window.location.pathname.startsWith('/auth/')) {
          window.location.href = '/auth/login';
        }
      }
    } else if (error.response?.status === 403) {
      // Handle forbidden access (insufficient permissions)
      console.warn('Forbidden: Insufficient permissions for this action');
    } else if (error.response?.status >= 500) {
      // Handle server errors
      console.error('Server error:', error.response.data);
    }
    
    return Promise.reject(error)
  }
)

// Generic API methods
export const apiClient = {
  get: async <T>(url: string): Promise<ApiResponse<T>> => {
    const response = await api.get(url)
    return response.data
  },
  
  post: async <T>(url: string, data?: any): Promise<ApiResponse<T>> => {
    const response = await api.post(url, data)
    return response.data
  },
  
  put: async <T>(url: string, data?: any): Promise<ApiResponse<T>> => {
    const response = await api.put(url, data)
    return response.data
  },
  
  delete: async <T>(url: string): Promise<ApiResponse<T>> => {
    const response = await api.delete(url)
    return response.data
  },
}

export default api