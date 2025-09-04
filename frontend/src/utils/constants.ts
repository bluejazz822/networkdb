// Application constants for Network CMDB Frontend

// API endpoints
export const API_ENDPOINTS = {
  // Network devices
  DEVICES: '/devices',
  DEVICE_BY_ID: (id: string) => `/devices/${id}`,
  
  // VPCs
  VPCS: '/vpcs',
  VPC_BY_ID: (id: string) => `/vpcs/${id}`,
  
  // Subnets
  SUBNETS: '/subnets',
  SUBNET_BY_ID: (id: string) => `/subnets/${id}`,
  SUBNETS_BY_VPC: (vpcId: string) => `/vpcs/${vpcId}/subnets`,
  
  // Transit Gateways
  TRANSIT_GATEWAYS: '/transit-gateways',
  TRANSIT_GATEWAY_BY_ID: (id: string) => `/transit-gateways/${id}`,
  
  // Dashboard
  DASHBOARD_STATS: '/dashboard/stats',
  DASHBOARD_ACTIVITY: '/dashboard/activity',
  DASHBOARD_HEALTH: '/dashboard/health',
}

// Status types and colors
export const DEVICE_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance',
} as const

export const VPC_STATUSES = {
  AVAILABLE: 'available',
  PENDING: 'pending',
  DELETED: 'deleted',
} as const

export const SUBNET_STATUSES = {
  AVAILABLE: 'available',
  PENDING: 'pending',
  DELETED: 'deleted',
} as const

export const TGW_STATUSES = {
  AVAILABLE: 'available',
  PENDING: 'pending',
  MODIFYING: 'modifying',
  DELETING: 'deleting',
  DELETED: 'deleted',
} as const

export const DEVICE_TYPES = {
  ROUTER: 'router',
  SWITCH: 'switch',
  FIREWALL: 'firewall',
  LOAD_BALANCER: 'load-balancer',
} as const

export const SUBNET_TYPES = {
  PUBLIC: 'public',
  PRIVATE: 'private',
} as const

// Application configuration
export const APP_CONFIG = {
  TITLE: import.meta.env.VITE_APP_TITLE || 'Network CMDB Dashboard',
  VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
  ENVIRONMENT: import.meta.env.VITE_APP_ENVIRONMENT || 'development',
}

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: ['10', '20', '50', '100'],
  SHOW_SIZE_CHANGER: true,
  SHOW_QUICK_JUMPER: true,
}

// Table configuration
export const TABLE_CONFIG = {
  SCROLL_X: 800,
  ROW_KEY: 'id',
  SIZE: 'middle' as const,
}

// Form validation rules
export const VALIDATION_RULES = {
  REQUIRED: { required: true, message: 'This field is required' },
  EMAIL: { type: 'email' as const, message: 'Please enter a valid email address' },
  IP_ADDRESS: {
    pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    message: 'Please enter a valid IP address',
  },
  CIDR: {
    pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/,
    message: 'Please enter a valid CIDR block (e.g., 10.0.0.0/16)',
  },
}

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_PREFERENCES: 'user_preferences',
  TABLE_SETTINGS: 'table_settings',
}

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred. Please check your connection and try again.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  NOT_FOUND: 'The requested resource was not found.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  VALIDATION_ERROR: 'Please check your input and try again.',
}

// Success messages
export const SUCCESS_MESSAGES = {
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  SAVED: 'Changes saved successfully',
}