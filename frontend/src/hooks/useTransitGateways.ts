import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import { transitGatewaysApi } from '@/services/networkService'
import type { TransitGateway } from '@/types/index'

const QUERY_KEY = 'transitGateways'

// Query hook for fetching all transit gateways
export const useTransitGateways = (params?: {
  page?: number
  limit?: number
  search?: string
  status?: string
}) => {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => transitGatewaysApi.getAll(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Query hook for fetching a single transit gateway
export const useTransitGateway = (id: string) => {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => transitGatewaysApi.getById(id),
    enabled: !!id,
  })
}

// Mutation hook for creating a transit gateway
export const useCreateTransitGateway = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<TransitGateway, 'id' | 'createdAt'>) => 
      transitGatewaysApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      message.success('Transit Gateway created successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to create Transit Gateway: ${error.message}`)
    },
  })
}

// Mutation hook for updating a transit gateway
export const useUpdateTransitGateway = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TransitGateway> }) =>
      transitGatewaysApi.update(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      queryClient.setQueryData([QUERY_KEY, variables.id], data)
      message.success('Transit Gateway updated successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to update Transit Gateway: ${error.message}`)
    },
  })
}

// Mutation hook for deleting a transit gateway
export const useDeleteTransitGateway = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => transitGatewaysApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      message.success('Transit Gateway deleted successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to delete Transit Gateway: ${error.message}`)
    },
  })
}

// Mutation hook for bulk deleting transit gateways
export const useBulkDeleteTransitGateways = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => transitGatewaysApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      message.success('Transit Gateways deleted successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to delete Transit Gateways: ${error.message}`)
    },
  })
}