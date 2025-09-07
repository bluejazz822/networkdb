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
          
          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* User profile (requires authentication only) */}
          <Route path="/profile" element={
            <AuthGuard>
              <Layout style={{ minHeight: '100vh' }}>
                <MainLayout>
                  <ProfilePage />
                </MainLayout>
              </Layout>
            </AuthGuard>
          } />
          
          {/* Dashboard (requires dashboard read permission) */}
          <Route path="/dashboard" element={
            <AuthGuard>
              <ProtectedRoute permission={PERMISSIONS.DASHBOARD_READ}>
                <Layout style={{ minHeight: '100vh' }}>
                  <MainLayout>
                    <Dashboard />
                  </MainLayout>
                </Layout>
              </ProtectedRoute>
            </AuthGuard>
          } />
          
          {/* Network resource routes (require network read permission) */}
          <Route path="/devices" element={
            <AuthGuard>
              <ProtectedRoute permission={PERMISSIONS.NETWORK_READ}>
                <Layout style={{ minHeight: '100vh' }}>
                  <MainLayout>
                    <NetworkDevices />
                  </MainLayout>
                </Layout>
              </ProtectedRoute>
            </AuthGuard>
          } />
          
          <Route path="/vpcs" element={
            <AuthGuard>
              <ProtectedRoute permission={PERMISSIONS.VPC_READ}>
                <Layout style={{ minHeight: '100vh' }}>
                  <MainLayout>
                    <VPCs />
                  </MainLayout>
                </Layout>
              </ProtectedRoute>
            </AuthGuard>
          } />
          
          <Route path="/subnets" element={
            <AuthGuard>
              <ProtectedRoute permission={PERMISSIONS.NETWORK_READ}>
                <Layout style={{ minHeight: '100vh' }}>
                  <MainLayout>
                    <Subnets />
                  </MainLayout>
                </Layout>
              </ProtectedRoute>
            </AuthGuard>
          } />
          
          <Route path="/transit-gateways" element={
            <AuthGuard>
              <ProtectedRoute permission={PERMISSIONS.NETWORK_READ}>
                <Layout style={{ minHeight: '100vh' }}>
                  <MainLayout>
                    <TransitGateways />
                  </MainLayout>
                </Layout>
              </ProtectedRoute>
            </AuthGuard>
          } />
          
          {/* Admin routes */}
          <Route path="/admin/users" element={
            <AuthGuard>
              <ProtectedRoute permission={PERMISSIONS.USER_READ}>
                <Layout style={{ minHeight: '100vh' }}>
                  <MainLayout>
                    <UserManagementPage />
                  </MainLayout>
                </Layout>
              </ProtectedRoute>
            </AuthGuard>
          } />
          
          <Route path="/admin/roles" element={
            <AuthGuard>
              <ProtectedRoute permission={PERMISSIONS.ROLE_READ}>
                <Layout style={{ minHeight: '100vh' }}>
                  <MainLayout>
                    <RoleManagementPage />
                  </MainLayout>
                </Layout>
              </ProtectedRoute>
            </AuthGuard>
          } />
          
          <Route path="/admin/security" element={
            <AuthGuard>
              <ProtectedRoute permission={PERMISSIONS.SYSTEM_READ}>
                <Layout style={{ minHeight: '100vh' }}>
                  <MainLayout>
                    <SecurityDashboard />
                  </MainLayout>
                </Layout>
              </ProtectedRoute>
            </AuthGuard>
          } />
          
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App