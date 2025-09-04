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