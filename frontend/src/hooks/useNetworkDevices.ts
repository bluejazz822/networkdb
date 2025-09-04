import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import { networkDevicesApi } from '@/services/networkService'
import type { NetworkDevice } from '@/types/index'

const QUERY_KEY = 'networkDevices'

// Query hook for fetching all network devices
export const useNetworkDevices = (params?: {
  page?: number
  limit?: number
  search?: string
  type?: string
  status?: string
}) => {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => networkDevicesApi.getAll(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Query hook for fetching a single network device
export const useNetworkDevice = (id: string) => {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => networkDevicesApi.getById(id),
    enabled: !!id,
  })
}

// Mutation hook for creating a network device
export const useCreateNetworkDevice = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<NetworkDevice, 'id' | 'lastSeen'>) =>
      networkDevicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      message.success('Network device created successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to create network device: ${error.message}`)
    },
  })
}

// Mutation hook for updating a network device
export const useUpdateNetworkDevice = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NetworkDevice> }) =>
      networkDevicesApi.update(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      queryClient.setQueryData([QUERY_KEY, variables.id], data)
      message.success('Network device updated successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to update network device: ${error.message}`)
    },
  })
}

// Mutation hook for deleting a network device
export const useDeleteNetworkDevice = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => networkDevicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      message.success('Network device deleted successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to delete network device: ${error.message}`)
    },
  })
}

// Mutation hook for bulk deleting network devices
export const useBulkDeleteNetworkDevices = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => networkDevicesApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      message.success('Network devices deleted successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to delete network devices: ${error.message}`)
    },
  })
}