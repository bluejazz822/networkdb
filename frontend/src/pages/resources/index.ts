// Resource management pages
export { ResourceListPage } from './ResourceListPage';
export { ResourceDetailPage } from './ResourceDetailPage';
export { VpcManagementPage } from './VpcManagementPage';
export { TransitGatewayManagementPage } from './TransitGatewayManagementPage';
export { NetworkResourcesPage } from './NetworkResourcesPage';

// Re-export types
export type { NetworkResourceType, NetworkResource } from '../../hooks/useNetworkManagement';
export type {
  VPC,
  TransitGateway,
  CustomerGateway,
  VpcEndpoint,
  ResourceRelationship,
  BulkOperation,
  ResourceHealth,
  Alert,
  NetworkTopology,
  TopologyNode,
  TopologyEdge
} from '../../types';