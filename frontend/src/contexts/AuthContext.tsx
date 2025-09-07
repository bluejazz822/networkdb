import React, { createContext, useContext, useState, useEffect } from 'react'

export interface User {
  username: string
  role: 'admin' | 'user'
  permissions: {
    canEdit: boolean
    canDelete: boolean
    canCreate: boolean
  }
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  isAuthenticated: boolean
  hasPermission: (action: 'edit' | 'delete' | 'create') => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Local user accounts
const LOCAL_ACCOUNTS = {
  admin: {
    password: 'admin123',
    role: 'admin' as const,
    permissions: {
      canEdit: true,
      canDelete: true,
      canCreate: true
    }
  },
  user: {
    password: 'user123',
    role: 'user' as const,
    permissions: {
      canEdit: false,
      canDelete: false,
      canCreate: false
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // Check for stored session
    const storedUser = localStorage.getItem('networkCMDB_user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (error) {
        localStorage.removeItem('networkCMDB_user')
      }
    }
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))

    const account = LOCAL_ACCOUNTS[username as keyof typeof LOCAL_ACCOUNTS]
    
    if (account && account.password === password) {
      const userData: User = {
        username,
        role: account.role,
        permissions: account.permissions
      }
      
      setUser(userData)
      localStorage.setItem('networkCMDB_user', JSON.stringify(userData))
      return true
    }
    
    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('networkCMDB_user')
  }

  const hasPermission = (action: 'edit' | 'delete' | 'create'): boolean => {
    if (!user) return false
    
    switch (action) {
      case 'edit':
        return user.permissions.canEdit
      case 'delete':
        return user.permissions.canDelete
      case 'create':
        return user.permissions.canCreate
      default:
        return false
    }
  }

  const value: AuthContextType = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    hasPermission
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}