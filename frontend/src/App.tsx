import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import { AuthProvider } from '@/contexts/AuthContext'
import MainLayout from '@components/layout/MainLayout'
import { AuthGuard, PermissionGuard } from '@/components/auth'
import { ProtectedRoute } from '@/guards'
import { 
  LoginPage, 
  RegisterPage, 
  ForgotPasswordPage, 
  ResetPasswordPage, 
  ProfilePage 
} from '@/pages/auth'
import Dashboard from '@pages/DashboardNew'
import NetworkDevices from '@pages/NetworkDevicesNew'
import VPCs from '@pages/VPCsNew'
import Subnets from '@pages/Subnets'
import TransitGateways from '@pages/TransitGateways'
import { 
  UserManagementPage, 
  RoleManagementPage, 
  SecurityDashboard 
} from '@/pages/admin'
import { PERMISSIONS } from '@/utils/permissions'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public authentication routes */}
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <AuthGuard>
              <Layout style={{ minHeight: '100vh' }}>
                <MainLayout>
                  <Routes>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    
                    {/* User profile (requires authentication only) */}
                    <Route path="/profile" element={<ProfilePage />} />
                    
                    {/* Dashboard (requires dashboard read permission) */}
                    <Route path="/dashboard" element={
                      <ProtectedRoute permission={PERMISSIONS.DASHBOARD_READ}>
                        <Dashboard />
                      </ProtectedRoute>
                    } />
                    
                    {/* Network resource routes (require network read permission) */}
                    <Route path="/devices" element={
                      <ProtectedRoute permission={PERMISSIONS.NETWORK_READ}>
                        <NetworkDevices />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/vpcs" element={
                      <ProtectedRoute permission={PERMISSIONS.VPC_READ}>
                        <VPCs />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/subnets" element={
                      <ProtectedRoute permission={PERMISSIONS.NETWORK_READ}>
                        <Subnets />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/transit-gateways" element={
                      <ProtectedRoute permission={PERMISSIONS.NETWORK_READ}>
                        <TransitGateways />
                      </ProtectedRoute>
                    } />
                    
                    {/* Admin routes */}
                    <Route path="/admin/users" element={
                      <ProtectedRoute permission={PERMISSIONS.USER_READ}>
                        <UserManagementPage />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/admin/roles" element={
                      <ProtectedRoute permission={PERMISSIONS.ROLE_READ}>
                        <RoleManagementPage />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/admin/security" element={
                      <ProtectedRoute permission={PERMISSIONS.SYSTEM_READ}>
                        <SecurityDashboard />
                      </ProtectedRoute>
                    } />
                    
                    {/* Catch-all redirect */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </MainLayout>
              </Layout>
            </AuthGuard>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App