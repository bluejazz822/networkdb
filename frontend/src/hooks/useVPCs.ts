import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import { vpcsApi } from '@/services/networkService'
import type { VPC } from '@/types/index'

const QUERY_KEY = 'vpcs'

// Query hook for fetching all VPCs
export const useVPCs = (params?: {
  page?: number
  limit?: number
  search?: string
  region?: string
  status?: string
}) => {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => vpcsApi.getAll(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Query hook for fetching a single VPC
export const useVPC = (id: string) => {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => vpcsApi.getById(id),
    enabled: !!id,
  })
}

// Mutation hook for creating a VPC
export const useCreateVPC = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<VPC, 'id' | 'createdAt'>) => vpcsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      message.success('VPC created successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to create VPC: ${error.message}`)
    },
  })
}

// Mutation hook for updating a VPC
export const useUpdateVPC = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VPC> }) =>
      vpcsApi.update(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      queryClient.setQueryData([QUERY_KEY, variables.id], data)
      message.success('VPC updated successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to update VPC: ${error.message}`)
    },
  })
}

// Mutation hook for deleting a VPC
export const useDeleteVPC = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => vpcsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      message.success('VPC deleted successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to delete VPC: ${error.message}`)
    },
  })
}

// Mutation hook for bulk deleting VPCs
export const useBulkDeleteVPCs = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => vpcsApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      message.success('VPCs deleted successfully')
    },
    onError: (error: any) => {
      message.error(`Failed to delete VPCs: ${error.message}`)
    },
  })
}