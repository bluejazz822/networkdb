import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { apiClient } from '../utils/api';
import type { 
  VPC, 
  TransitGateway, 
  CustomerGateway, 
  VpcEndpoint,
  SearchQuery,
  BulkOperation,
  ResourceHealth,
  NetworkTopology,
  PaginatedResponse
} from '../types';

// Resource type union
export type NetworkResource = VPC | TransitGateway | CustomerGateway | VpcEndpoint;
export type NetworkResourceType = 'vpc' | 'transit-gateway' | 'customer-gateway' | 'vpc-endpoint';

interface UseNetworkManagementOptions {
  resourceType: NetworkResourceType;
  autoLoad?: boolean;
  pageSize?: number;
}

interface NetworkManagementState {
  resources: NetworkResource[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  selectedItems: NetworkResource[];
  searchQuery: SearchQuery;
  bulkOperations: BulkOperation[];
  healthData: Record<string, ResourceHealth>;
}

export const useNetworkManagement = (options: UseNetworkManagementOptions) => {
  const { resourceType, autoLoad = true, pageSize = 20 } = options;

  // State management
  const [state, setState] = useState<NetworkManagementState>({
    resources: [],
    loading: false,
    error: null,
    total: 0,
    page: 1,
    pageSize,
    selectedItems: [],
    searchQuery: {
      filters: [],
      page: 1,
      limit: pageSize,
      sortBy: 'name',
      sortOrder: 'asc'
    },
    bulkOperations: [],
    healthData: {}
  });

  // Update state helper
  const updateState = useCallback((updates: Partial<NetworkManagementState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // API endpoints mapping
  const getEndpoint = useCallback((type: NetworkResourceType, suffix = ''): string => {
    const endpoints = {
      'vpc': '/vpcs',
      'transit-gateway': '/transit-gateways',
      'customer-gateway': '/customer-gateways',
      'vpc-endpoint': '/vpc-endpoints'
    };
    return `${endpoints[type]}${suffix}`;
  }, []);

  // Load resources with current search/filter settings
  const loadResources = useCallback(async (query?: Partial<SearchQuery>) => {
    updateState({ loading: true, error: null });

    try {
      const searchParams = { ...state.searchQuery, ...query };
      const endpoint = getEndpoint(resourceType);
      
      // Build query string
      const params = new URLSearchParams();
      if (searchParams.search) params.append('search', searchParams.search);
      if (searchParams.sortBy) params.append('sortBy', searchParams.sortBy);
      if (searchParams.sortOrder) params.append('sortOrder', searchParams.sortOrder);
      if (searchParams.page) params.append('page', searchParams.page.toString());
      if (searchParams.limit) params.append('limit', searchParams.limit.toString());
      
      // Add filters
      searchParams.filters.forEach((filter, index) => {
        params.append(`filters[${index}][field]`, filter.field);
        params.append(`filters[${index}][operator]`, filter.operator);
        params.append(`filters[${index}][value]`, String(filter.value));
      });

      const response = await apiClient.get<PaginatedResponse<NetworkResource>>(
        `${endpoint}?${params.toString()}`
      );

      if (response.success) {
        updateState({
          resources: response.data.items,
          total: response.data.total,
          page: response.data.page,
          pageSize: response.data.limit,
          searchQuery: searchParams,
          loading: false
        });
      } else {
        throw new Error(response.error || 'Failed to load resources');
      }
    } catch (error: any) {
      console.error('Failed to load resources:', error);
      updateState({ 
        loading: false, 
        error: error.message || 'Failed to load resources' 
      });
      message.error(`Failed to load ${resourceType}s: ${error.message}`);
    }
  }, [resourceType, state.searchQuery, getEndpoint, updateState]);

  // Search resources
  const search = useCallback(async (searchTerm: string) => {
    await loadResources({ search: searchTerm, page: 1 });
  }, [loadResources]);

  // Apply filters
  const applyFilters = useCallback(async (filters: SearchQuery['filters']) => {
    await loadResources({ filters, page: 1 });
  }, [loadResources]);

  // Sort resources
  const sort = useCallback(async (sortBy: string, sortOrder: 'asc' | 'desc') => {
    await loadResources({ sortBy, sortOrder });
  }, [loadResources]);

  // Paginate
  const paginate = useCallback(async (page: number, limit?: number) => {
    await loadResources({ page, limit });
  }, [loadResources]);

  // Refresh resources
  const refresh = useCallback(() => {
    return loadResources();
  }, [loadResources]);

  // Load single resource
  const loadResource = useCallback(async (id: string): Promise<NetworkResource | null> => {
    try {
      const endpoint = getEndpoint(resourceType, `/${id}`);
      const response = await apiClient.get<NetworkResource>(endpoint);
      
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to load resource');
    } catch (error: any) {
      console.error('Failed to load resource:', error);
      message.error(`Failed to load resource: ${error.message}`);
      return null;
    }
  }, [resourceType, getEndpoint]);

  // Create resource
  const createResource = useCallback(async (data: Partial<NetworkResource>): Promise<boolean> => {
    try {
      const endpoint = getEndpoint(resourceType);
      const response = await apiClient.post<NetworkResource>(endpoint, data);
      
      if (response.success) {
        message.success(`${resourceType} created successfully`);
        await refresh();
        return true;
      }
      throw new Error(response.error || 'Failed to create resource');
    } catch (error: any) {
      console.error('Failed to create resource:', error);
      message.error(`Failed to create ${resourceType}: ${error.message}`);
      return false;
    }
  }, [resourceType, getEndpoint, refresh]);

  // Update resource
  const updateResource = useCallback(async (id: string, data: Partial<NetworkResource>): Promise<boolean> => {
    try {
      const endpoint = getEndpoint(resourceType, `/${id}`);
      const response = await apiClient.put<NetworkResource>(endpoint, data);
      
      if (response.success) {
        message.success(`${resourceType} updated successfully`);
        await refresh();
        return true;
      }
      throw new Error(response.error || 'Failed to update resource');
    } catch (error: any) {
      console.error('Failed to update resource:', error);
      message.error(`Failed to update ${resourceType}: ${error.message}`);
      return false;
    }
  }, [resourceType, getEndpoint, refresh]);

  // Delete resource
  const deleteResource = useCallback(async (id: string): Promise<boolean> => {
    try {
      const endpoint = getEndpoint(resourceType, `/${id}`);
      const response = await apiClient.delete(endpoint);
      
      if (response.success) {
        message.success(`${resourceType} deleted successfully`);
        await refresh();
        return true;
      }
      throw new Error(response.error || 'Failed to delete resource');
    } catch (error: any) {
      console.error('Failed to delete resource:', error);
      message.error(`Failed to delete ${resourceType}: ${error.message}`);
      return false;
    }
  }, [resourceType, getEndpoint, refresh]);

  // Selection management
  const setSelectedItems = useCallback((items: NetworkResource[]) => {
    updateState({ selectedItems: items });
  }, [updateState]);

  const selectAll = useCallback(() => {
    updateState({ selectedItems: state.resources });
  }, [state.resources, updateState]);

  const clearSelection = useCallback(() => {
    updateState({ selectedItems: [] });
  }, [updateState]);

  // Bulk operations
  const bulkUpdate = useCallback(async (updates: Partial<NetworkResource>): Promise<boolean> => {
    if (state.selectedItems.length === 0) {
      message.warning('Please select items to update');
      return false;
    }

    try {
      const ids = state.selectedItems.map(item => item.id);
      const response = await apiClient.post<BulkOperation>('/bulk/update', {
        resourceType,
        resourceIds: ids,
        payload: updates
      });

      if (response.success) {
        message.success(`Bulk update initiated for ${ids.length} items`);
        clearSelection();
        return true;
      }
      throw new Error(response.error || 'Failed to start bulk update');
    } catch (error: any) {
      console.error('Failed to bulk update:', error);
      message.error(`Failed to bulk update: ${error.message}`);
      return false;
    }
  }, [resourceType, state.selectedItems, clearSelection]);

  const bulkDelete = useCallback(async (): Promise<boolean> => {
    if (state.selectedItems.length === 0) {
      message.warning('Please select items to delete');
      return false;
    }

    try {
      const ids = state.selectedItems.map(item => item.id);
      const response = await apiClient.post<BulkOperation>('/bulk/delete', {
        resourceType,
        resourceIds: ids
      });

      if (response.success) {
        message.success(`Bulk delete initiated for ${ids.length} items`);
        clearSelection();
        await refresh();
        return true;
      }
      throw new Error(response.error || 'Failed to start bulk delete');
    } catch (error: any) {
      console.error('Failed to bulk delete:', error);
      message.error(`Failed to bulk delete: ${error.message}`);
      return false;
    }
  }, [resourceType, state.selectedItems, clearSelection, refresh]);

  // Export resources
  const exportResources = useCallback(async (format: 'csv' | 'json' | 'excel' = 'csv', selectedOnly = false): Promise<boolean> => {
    try {
      const ids = selectedOnly ? state.selectedItems.map(item => item.id) : undefined;
      const response = await apiClient.post('/import-export/export', {
        resourceType,
        format,
        resourceIds: ids,
        searchQuery: selectedOnly ? undefined : state.searchQuery
      });

      if (response.success) {
        message.success('Export started. You will be notified when it\'s ready.');
        return true;
      }
      throw new Error(response.error || 'Failed to start export');
    } catch (error: any) {
      console.error('Failed to export:', error);
      message.error(`Failed to export: ${error.message}`);
      return false;
    }
  }, [resourceType, state.selectedItems, state.searchQuery]);

  // Health monitoring
  const loadHealthData = useCallback(async () => {
    try {
      const ids = state.resources.map(resource => resource.id);
      if (ids.length === 0) return;

      const response = await apiClient.post<Record<string, ResourceHealth>>('/monitoring/health', {
        resourceIds: ids
      });

      if (response.success) {
        updateState({ healthData: response.data });
      }
    } catch (error: any) {
      console.error('Failed to load health data:', error);
    }
  }, [state.resources, updateState]);

  // Network topology
  const loadNetworkTopology = useCallback(async (): Promise<NetworkTopology | null> => {
    try {
      const response = await apiClient.get<NetworkTopology>('/network/topology');
      
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to load network topology');
    } catch (error: any) {
      console.error('Failed to load network topology:', error);
      message.error(`Failed to load network topology: ${error.message}`);
      return null;
    }
  }, []);

  // Load bulk operations status
  const loadBulkOperations = useCallback(async () => {
    try {
      const response = await apiClient.get<PaginatedResponse<BulkOperation>>('/bulk/operations');
      
      if (response.success) {
        updateState({ bulkOperations: response.data.items });
      }
    } catch (error: any) {
      console.error('Failed to load bulk operations:', error);
    }
  }, [updateState]);

  // Auto-load resources on mount
  useEffect(() => {
    if (autoLoad) {
      loadResources();
      loadBulkOperations();
    }
  }, [autoLoad, loadResources, loadBulkOperations]);

  // Auto-refresh health data when resources change
  useEffect(() => {
    if (state.resources.length > 0) {
      const timer = setTimeout(() => {
        loadHealthData();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.resources, loadHealthData]);

  return {
    // State
    ...state,
    
    // Resource operations
    loadResources,
    loadResource,
    createResource,
    updateResource,
    deleteResource,
    refresh,
    
    // Search and filtering
    search,
    applyFilters,
    sort,
    paginate,
    
    // Selection
    setSelectedItems,
    selectAll,
    clearSelection,
    
    // Bulk operations
    bulkUpdate,
    bulkDelete,
    exportResources,
    loadBulkOperations,
    
    // Monitoring
    loadHealthData,
    loadNetworkTopology,
    
    // Computed properties
    hasSelection: state.selectedItems.length > 0,
    isAllSelected: state.selectedItems.length === state.resources.length && state.resources.length > 0
  };
};