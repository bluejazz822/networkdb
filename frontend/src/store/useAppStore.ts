import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface UIState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  currentPage: string
  breadcrumbs: Array<{ title: string; path?: string }>
  loading: boolean
  error: string | null
}

interface UIActions {
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setTheme: (theme: 'light' | 'dark') => void
  setCurrentPage: (page: string) => void
  setBreadcrumbs: (breadcrumbs: Array<{ title: string; path?: string }>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

interface AppStore extends UIState, UIActions {}

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        sidebarCollapsed: false,
        theme: 'light',
        currentPage: 'Dashboard',
        breadcrumbs: [{ title: 'Dashboard' }],
        loading: false,
        error: null,

        // Actions
        toggleSidebar: () =>
          set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

        setSidebarCollapsed: (collapsed) =>
          set({ sidebarCollapsed: collapsed }),

        setTheme: (theme) =>
          set({ theme }),

        setCurrentPage: (page) =>
          set({ currentPage: page }),

        setBreadcrumbs: (breadcrumbs) =>
          set({ breadcrumbs }),

        setLoading: (loading) =>
          set({ loading }),

        setError: (error) =>
          set({ error }),

        clearError: () =>
          set({ error: null }),
      }),
      {
        name: 'app-store',
        partialize: (state) => ({
          sidebarCollapsed: state.sidebarCollapsed,
          theme: state.theme,
        }),
      }
    ),
    {
      name: 'app-store',
    }
  )
)