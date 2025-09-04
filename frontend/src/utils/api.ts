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

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Log responses in development
    if (import.meta.env.VITE_ENABLE_DEBUG === 'true') {
      console.log(`API Response: ${response.status}`, response.data)
    }
    
    return response
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    } else if (error.response?.status >= 500) {
      // Handle server errors
      console.error('Server error:', error.response.data)
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