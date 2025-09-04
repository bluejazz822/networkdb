// Network entity types matching backend models
export interface NetworkDevice {
  id: string;
  name: string;
  type: 'router' | 'switch' | 'firewall' | 'load-balancer';
  ipAddress: string;
  status: 'active' | 'inactive' | 'maintenance';
  location: string;
  lastSeen: string;
}

// Base interface for all network resources
export interface BaseNetworkResource {
  id: string;
  name?: string;
  description?: string;
  tags?: Record<string, any>;
  sourceSystem: string;
  lastSyncAt?: string;
  syncVersion: number;
  environment?: string;
  project?: string;
  costCenter?: string;
  owner?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface VPC extends BaseNetworkResource {
  awsVpcId: string;
  awsAccountId: string;
  cidrBlock: string;
  cidrBlockAssociationSet?: any;
  dhcpOptionsId?: string;
  state: 'pending' | 'available' | 'deleting' | 'deleted' | 'failed';
  statusId: string;
  region: string;
  regionId: string;
  availabilityZones?: string[];
  isDefault: boolean;
  instanceTenancy: 'default' | 'dedicated' | 'host';
  enableDnsHostnames: boolean;
  enableDnsSupport: boolean;
  enableNetworkAddressUsageMetrics: boolean;
}

export interface TransitGateway extends BaseNetworkResource {
  awsTgwId: string;
  awsAccountId: string;
  amazonSideAsn: number;
  autoAcceptSharedAttachments: boolean;
  defaultRouteTableAssociation: 'enable' | 'disable';
  defaultRouteTablePropagation: 'enable' | 'disable';
  dnsSupport: 'enable' | 'disable';
  multicast: 'enable' | 'disable';
  state: 'pending' | 'available' | 'modifying' | 'deleting' | 'deleted';
  statusId: string;
  region: string;
  regionId: string;
  vpnEcmpSupport: 'enable' | 'disable';
  transitGatewayType: 'tgw';
}

export interface CustomerGateway extends BaseNetworkResource {
  awsCgwId: string;
  awsAccountId: string;
  bgpAsn: number;
  ipAddress: string;
  type: 'ipsec.1';
  deviceName?: string;
  certificateArn?: string;
  state: 'pending' | 'available' | 'deleting' | 'deleted';
  statusId: string;
  region: string;
  regionId: string;
}

export interface VpcEndpoint extends BaseNetworkResource {
  awsVpeId: string;
  awsAccountId: string;
  vpcId?: string;
  serviceName: string;
  vpcEndpointType: 'Interface' | 'Gateway' | 'GatewayLoadBalancer';
  state: 'PendingAcceptance' | 'Pending' | 'Available' | 'Deleting' | 'Deleted' | 'Rejected' | 'Failed' | 'Expired';
  statusId: string;
  region: string;
  regionId: string;
  routeTableIds?: string[];
  subnetIds?: string[];
  groups?: any[];
  privateDnsEnabled?: boolean;
  requesterManaged?: boolean;
  networkInterfaceIds?: string[];
  dnsEntries?: any[];
  creationTimestamp?: string;
  policyDocument?: string;
}

// Legacy compatibility
export interface Subnet {
  id: string;
  name: string;
  vpcId: string;
  cidr: string;
  availabilityZone: string;
  type: 'public' | 'private';
  status: 'available' | 'pending' | 'deleted';
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

// Search and filtering types
export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn';
  value: any;
  label?: string;
}

export interface SearchQuery {
  filters: SearchFilter[];
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: SearchQuery;
  resourceType: string;
  createdBy: string;
  createdAt: string;
  isPublic: boolean;
}

// Resource relationship types
export interface ResourceRelationship {
  id: string;
  sourceId: string;
  sourceType: string;
  targetId: string;
  targetType: string;
  relationshipType: 'depends_on' | 'contains' | 'connects_to' | 'routes_to' | 'attached_to';
  metadata?: Record<string, any>;
  createdAt: string;
}

// Bulk operation types
export interface BulkOperation {
  id: string;
  type: 'update' | 'delete' | 'export' | 'import';
  resourceType: string;
  resourceIds: string[];
  payload?: any;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalItems: number;
  processedItems: number;
  errors?: string[];
  createdBy: string;
  createdAt: string;
  completedAt?: string;
}

// Monitoring types
export interface ResourceHealth {
  resourceId: string;
  resourceType: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastChecked: string;
  metrics?: Record<string, number>;
  alerts?: Alert[];
}

export interface Alert {
  id: string;
  resourceId: string;
  resourceType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
}

// Network topology types
export interface NetworkTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  metadata: {
    lastUpdated: string;
    regions: string[];
    accounts: string[];
  };
}

export interface TopologyNode {
  id: string;
  type: 'vpc' | 'transit-gateway' | 'customer-gateway' | 'vpc-endpoint' | 'subnet';
  label: string;
  properties: Record<string, any>;
  position?: { x: number; y: number };
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: 'attachment' | 'peering' | 'routing' | 'association';
  label?: string;
  properties: Record<string, any>;
  status: 'active' | 'inactive' | 'pending';
}

// Authentication and User types
export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  mfaEnabled: boolean;
  loginAttempts: number;
  accountLockedUntil?: string;
  createdAt: string;
  updatedAt: string;
  roles?: Role[];
  permissions?: string[];
  fullName?: string;
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  resource: string;
  action: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  fullPermission?: string;
}

// Authentication request/response types
export interface LoginRequest {
  username: string;
  password: string;
  mfaToken?: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    expiresIn: number;
    refreshToken?: string;
  };
  message?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  email: string;
}

// MFA types
export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MfaVerifyRequest {
  token: string;
  backupCode?: string;
}

// Session and security types
export interface UserSession {
  id: string;
  userId: string;
  deviceInfo: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  lastActivity: string;
  createdAt: string;
}

export interface SecurityEvent {
  id: string;
  userId: string;
  eventType: 'login' | 'logout' | 'password_change' | 'mfa_enabled' | 'mfa_disabled' | 'account_locked' | 'failed_login';
  description: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// Authentication context types
export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  changePassword: (data: ChangePasswordRequest) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (roleName: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
}

// Permission checking utilities
export interface PermissionCheckOptions {
  requireAll?: boolean; // If true, user must have ALL permissions; if false, user must have ANY permission
  strict?: boolean; // If true, disabled users/roles are considered as having no permissions
}

// User management types
export interface UserListFilter {
  search?: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  roles?: string[];
  createdAfter?: string;
  createdBefore?: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roles?: string[];
  isActive?: boolean;
  sendWelcomeEmail?: boolean;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  roles?: string[];
}

// Role management types
export interface CreateRoleRequest {
  name: string;
  displayName: string;
  description?: string;
  permissions?: string[];
  priority?: number;
}

export interface UpdateRoleRequest {
  displayName?: string;
  description?: string;
  permissions?: string[];
  priority?: number;
  isActive?: boolean;
}

// Permission management types
export interface CreatePermissionRequest {
  name: string;
  displayName: string;
  description?: string;
  resource: string;
  action: string;
}

// Resource template types
export interface ResourceTemplate {
  id: string;
  name: string;
  description?: string;
  resourceType: string;
  template: Record<string, any>;
  parameters: TemplateParameter[];
  createdBy: string;
  createdAt: string;
  isPublic: boolean;
  usageCount: number;
}

export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: { label: string; value: any }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

// Wizard and form types
export interface FormStep {
  key: string;
  title: string;
  description?: string;
  fields: FormField[];
  validation?: (values: Record<string, any>) => Record<string, string>;
}

export interface FormField {
  name: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'textarea' | 'checkbox' | 'radio' | 'date' | 'tags';
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: { label: string; value: any }[];
  dependencies?: { field: string; value: any }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: any, allValues: Record<string, any>) => string | undefined;
  };
}