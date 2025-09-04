// Network entity types
export interface NetworkDevice {
  id: string;
  name: string;
  type: 'router' | 'switch' | 'firewall' | 'load-balancer';
  ipAddress: string;
  status: 'active' | 'inactive' | 'maintenance';
  location: string;
  lastSeen: string;
}

export interface VPC {
  id: string;
  name: string;
  cidr: string;
  region: string;
  status: 'available' | 'pending' | 'deleted';
  createdAt: string;
}

export interface Subnet {
  id: string;
  name: string;
  vpcId: string;
  cidr: string;
  availabilityZone: string;
  type: 'public' | 'private';
  status: 'available' | 'pending' | 'deleted';
}

export interface TransitGateway {
  id: string;
  name: string;
  description?: string;
  amazonSideAsn: number;
  status: 'available' | 'pending' | 'modifying' | 'deleting' | 'deleted';
  createdAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// UI State types
export interface DashboardStats {
  totalDevices: number;
  activeDevices: number;
  totalVPCs: number;
  totalSubnets: number;
}

// Theme types
export interface CMDBTheme {
  primaryColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  infoColor: string;
}