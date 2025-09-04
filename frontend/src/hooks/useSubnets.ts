import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import { subnetsApi } from '@/services/networkService'
import type { Subnet } from '@/types/index'

const QUERY_KEY = 'subnets'

// Query hook for fetching all subnets
export const useSubnets = (params?: {
  page?: number
  limit?: number
  search?: string
  vpcId?: string
  type?: string
  status?: string
  availabilityZone?: string
}) => {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => subnetsApi.getAll(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Query hook for fetching a single subnet
export const useSubnet = (id: string) => {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => subnetsApi.getById(id),
    enabled: !!id,
  })
}

// Mutation hook for creating a subnet
export const useCreateSubnet = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<Subnet, 'id'>) => subnetsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      message.success('Subnet created successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to create subnet: ${error.message}`)
    },
  })
}

// Mutation hook for updating a subnet
export const useUpdateSubnet = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Subnet> }) =>
      subnetsApi.update(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      queryClient.setQueryData([QUERY_KEY, variables.id], data)
      message.success('Subnet updated successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to update subnet: ${error.message}`)
    },
  })
}

// Mutation hook for deleting a subnet
export const useDeleteSubnet = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => subnetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      message.success('Subnet deleted successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to delete subnet: ${error.message}`)
    },
  })
}

// Mutation hook for bulk deleting subnets
export const useBulkDeleteSubnets = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => subnetsApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      message.success('Subnets deleted successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to delete subnets: ${error.message}`)
    },
  })
}