import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/services/networkService'

// Query hook for dashboard statistics
export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // refetch every 5 minutes
  })
}

// Query hook for recent activity
export const useRecentActivity = () => {
  return useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => dashboardApi.getRecentActivity(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 1 * 60 * 1000, // refetch every minute
  })
}

// Query hook for system health
export const useSystemHealth = () => {
  return useQuery({
    queryKey: ['dashboard', 'health'],
    queryFn: () => dashboardApi.getSystemHealth(),
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // refetch every 30 seconds
  })
}