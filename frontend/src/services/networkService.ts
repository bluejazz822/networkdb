import { apiClient } from '@/utils/api'
import type { 
  NetworkDevice, 
  VPC, 
  Subnet, 
  TransitGateway, 
  ApiResponse, 
  PaginatedResponse 
} from '@/types/index'

// Network Devices API
export const networkDevicesApi = {
  getAll: async (params?: {
    page?: number
    limit?: number
    search?: string
    type?: string
    status?: string
  }): Promise<PaginatedResponse<NetworkDevice>> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.search) searchParams.set('search', params.search)
    if (params?.type) searchParams.set('type', params.type)
    if (params?.status) searchParams.set('status', params.status)

    const response = await apiClient.get<PaginatedResponse<NetworkDevice>>(
      `/network-devices?${searchParams.toString()}`
    )
    return response.data
  },

  getById: async (id: string): Promise<NetworkDevice> => {
    const response = await apiClient.get<NetworkDevice>(`/network-devices/${id}`)
    return response.data
  },

  create: async (data: Omit<NetworkDevice, 'id' | 'lastSeen'>): Promise<NetworkDevice> => {
    const response = await apiClient.post<NetworkDevice>('/network-devices', data)
    return response.data
  },

  update: async (id: string, data: Partial<NetworkDevice>): Promise<NetworkDevice> => {
    const response = await apiClient.put<NetworkDevice>(`/network-devices/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/network-devices/${id}`)
  },

  bulkDelete: async (ids: string[]): Promise<void> => {
    await apiClient.post('/network-devices/bulk-delete', { ids })
  },
}

// VPCs API
export const vpcsApi = {
  getAll: async (params?: {
    page?: number
    limit?: number
    search?: string
    region?: string
    status?: string
  }): Promise<PaginatedResponse<VPC>> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.search) searchParams.set('search', params.search)
    if (params?.region) searchParams.set('region', params.region)
    if (params?.status) searchParams.set('status', params.status)

    const response = await apiClient.get<PaginatedResponse<VPC>>(
      `/vpcs?${searchParams.toString()}`
    )
    return response.data
  },

  getById: async (id: string): Promise<VPC> => {
    const response = await apiClient.get<VPC>(`/vpcs/${id}`)
    return response.data
  },

  create: async (data: Omit<VPC, 'id' | 'createdAt'>): Promise<VPC> => {
    const response = await apiClient.post<VPC>('/vpcs', data)
    return response.data
  },

  update: async (id: string, data: Partial<VPC>): Promise<VPC> => {
    const response = await apiClient.put<VPC>(`/vpcs/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/vpcs/${id}`)
  },

  bulkDelete: async (ids: string[]): Promise<void> => {
    await apiClient.post('/vpcs/bulk-delete', { ids })
  },
}

// Subnets API
export const subnetsApi = {
  getAll: async (params?: {
    page?: number
    limit?: number
    search?: string
    vpcId?: string
    type?: string
    status?: string
    availabilityZone?: string
  }): Promise<PaginatedResponse<Subnet>> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.search) searchParams.set('search', params.search)
    if (params?.vpcId) searchParams.set('vpcId', params.vpcId)
    if (params?.type) searchParams.set('type', params.type)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.availabilityZone) searchParams.set('availabilityZone', params.availabilityZone)

    const response = await apiClient.get<PaginatedResponse<Subnet>>(
      `/subnets?${searchParams.toString()}`
    )
    return response.data
  },

  getById: async (id: string): Promise<Subnet> => {
    const response = await apiClient.get<Subnet>(`/subnets/${id}`)
    return response.data
  },

  create: async (data: Omit<Subnet, 'id'>): Promise<Subnet> => {
    const response = await apiClient.post<Subnet>('/subnets', data)
    return response.data
  },

  update: async (id: string, data: Partial<Subnet>): Promise<Subnet> => {
    const response = await apiClient.put<Subnet>(`/subnets/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/subnets/${id}`)
  },

  bulkDelete: async (ids: string[]): Promise<void> => {
    await apiClient.post('/subnets/bulk-delete', { ids })
  },
}

// Transit Gateways API
export const transitGatewaysApi = {
  getAll: async (params?: {
    page?: number
    limit?: number
    search?: string
    status?: string
  }): Promise<PaginatedResponse<TransitGateway>> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.search) searchParams.set('search', params.search)
    if (params?.status) searchParams.set('status', params.status)

    const response = await apiClient.get<PaginatedResponse<TransitGateway>>(
      `/transit-gateways?${searchParams.toString()}`
    )
    return response.data
  },

  getById: async (id: string): Promise<TransitGateway> => {
    const response = await apiClient.get<TransitGateway>(`/transit-gateways/${id}`)
    return response.data
  },

  create: async (data: Omit<TransitGateway, 'id' | 'createdAt'>): Promise<TransitGateway> => {
    const response = await apiClient.post<TransitGateway>('/transit-gateways', data)
    return response.data
  },

  update: async (id: string, data: Partial<TransitGateway>): Promise<TransitGateway> => {
    const response = await apiClient.put<TransitGateway>(`/transit-gateways/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/transit-gateways/${id}`)
  },

  bulkDelete: async (ids: string[]): Promise<void> => {
    await apiClient.post('/transit-gateways/bulk-delete', { ids })
  },
}

// Dashboard API
export const dashboardApi = {
  getStats: async () => {
    const response = await apiClient.get<{
      totalDevices: number
      activeDevices: number
      totalVPCs: number
      totalSubnets: number
      totalTransitGateways: number
    }>('/dashboard/stats')
    return response.data
  },

  getRecentActivity: async () => {
    const response = await apiClient.get<Array<{
      id: string
      type: string
      action: string
      resource: string
      timestamp: string
      description: string
    }>>('/dashboard/activity')
    return response.data
  },

  getSystemHealth: async () => {
    const response = await apiClient.get<{
      database: 'online' | 'offline' | 'degraded'
      api: 'healthy' | 'unhealthy' | 'degraded'
      monitoring: 'active' | 'inactive'
      lastSync: string
    }>('/dashboard/health')
    return response.data
  },
}