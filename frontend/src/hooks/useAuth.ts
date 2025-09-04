import { useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { authService, userManagementService } from '@/services/authService';
import AuthContext from '@/contexts/AuthContext';
import type { 
  AuthContextType, 
  LoginRequest, 
  RegisterRequest, 
  ForgotPasswordRequest, 
  ResetPasswordRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  UserSession,
  SecurityEvent,
  MfaSetupResponse,
  MfaVerifyRequest
} from '@/types/index';

/**
 * Main authentication hook
 * Re-exports the context hook for easier imports
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook for authentication mutations with better error handling
 */
export function useAuthMutations() {
  const queryClient = useQueryClient();
  const { login: contextLogin, register: contextRegister } = useAuth();

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginRequest) => contextLogin(credentials),
    onSuccess: () => {
      message.success('Successfully logged in');
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Login failed');
    },
  });

  const registerMutation = useMutation({
    mutationFn: (userData: RegisterRequest) => contextRegister(userData),
    onSuccess: () => {
      message.success('Registration successful! Please check your email to verify your account.');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Registration failed');
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (data: ForgotPasswordRequest) => authService.forgotPassword(data),
    onSuccess: () => {
      message.success('Password reset email sent. Please check your inbox.');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to send reset email');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: ResetPasswordRequest) => authService.resetPassword(data),
    onSuccess: () => {
      message.success('Password reset successful. You can now log in with your new password.');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Password reset failed');
    },
  });

  return {
    login: loginMutation,
    register: registerMutation,
    forgotPassword: forgotPasswordMutation,
    resetPassword: resetPasswordMutation,
  };
}

/**
 * Hook for user profile management
 */
export function useUserProfile() {
  const { user, updateProfile: contextUpdateProfile, changePassword: contextChangePassword } = useAuth();
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateProfileRequest) => contextUpdateProfile(data),
    onSuccess: () => {
      message.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Profile update failed');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordRequest) => contextChangePassword(data),
    onSuccess: () => {
      message.success('Password changed successfully');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Password change failed');
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: (token: string) => authService.verifyEmail(token),
    onSuccess: () => {
      message.success('Email verified successfully');
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Email verification failed');
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: () => authService.resendVerificationEmail(),
    onSuccess: () => {
      message.success('Verification email sent');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to send verification email');
    },
  });

  return {
    user,
    updateProfile: updateProfileMutation,
    changePassword: changePasswordMutation,
    verifyEmail: verifyEmailMutation,
    resendVerification: resendVerificationMutation,
  };
}

/**
 * Hook for multi-factor authentication
 */
export function useMfa() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const setupMfaMutation = useMutation({
    mutationFn: () => authService.setupMfa(),
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'MFA setup failed');
    },
  });

  const verifyMfaMutation = useMutation({
    mutationFn: (data: MfaVerifyRequest) => authService.verifyMfa(data),
    onSuccess: (response) => {
      if (response.data.backupCodes) {
        message.success('MFA enabled successfully! Please save your backup codes.');
      } else {
        message.success('MFA verified successfully');
      }
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'MFA verification failed');
    },
  });

  const disableMfaMutation = useMutation({
    mutationFn: (data: { password: string; token: string }) => authService.disableMfa(data),
    onSuccess: () => {
      message.success('MFA disabled successfully');
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to disable MFA');
    },
  });

  return {
    isMfaEnabled: user?.mfaEnabled || false,
    setupMfa: setupMfaMutation,
    verifyMfa: verifyMfaMutation,
    disableMfa: disableMfaMutation,
  };
}

/**
 * Hook for session management
 */
export function useSessions() {
  const { isAuthenticated } = useAuth();

  const sessionsQuery = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => authService.getSessions(),
    enabled: isAuthenticated,
    select: (response) => response.data,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => authService.revokeSession(sessionId),
    onSuccess: () => {
      message.success('Session revoked successfully');
      sessionsQuery.refetch();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to revoke session');
    },
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: () => authService.revokeAllSessions(),
    onSuccess: () => {
      message.success('All sessions revoked successfully');
      // This will likely log out the current user, so we don't refetch
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to revoke all sessions');
    },
  });

  return {
    sessions: sessionsQuery.data || [],
    isLoading: sessionsQuery.isLoading,
    error: sessionsQuery.error,
    revokeSession: revokeSessionMutation,
    revokeAllSessions: revokeAllSessionsMutation,
  };
}

/**
 * Hook for security events
 */
export function useSecurityEvents(page = 1, limit = 20) {
  const { isAuthenticated } = useAuth();

  const securityEventsQuery = useQuery({
    queryKey: ['auth', 'security-events', page, limit],
    queryFn: () => authService.getSecurityEvents(page, limit),
    enabled: isAuthenticated,
    select: (response) => response.data,
  });

  return {
    events: securityEventsQuery.data?.items || [],
    total: securityEventsQuery.data?.total || 0,
    isLoading: securityEventsQuery.isLoading,
    error: securityEventsQuery.error,
  };
}

/**
 * Hook for permission checking with better TypeScript support
 */
export function usePermissions() {
  const { hasPermission, hasRole, hasAnyPermission, hasAllPermissions, user } = useAuth();

  // Helper functions with better error handling
  const checkPermission = (permission: string): boolean => {
    try {
      return hasPermission(permission);
    } catch {
      return false;
    }
  };

  const checkRole = (roleName: string): boolean => {
    try {
      return hasRole(roleName);
    } catch {
      return false;
    }
  };

  const checkAnyPermission = (permissions: string[]): boolean => {
    try {
      return hasAnyPermission(permissions);
    } catch {
      return false;
    }
  };

  const checkAllPermissions = (permissions: string[]): boolean => {
    try {
      return hasAllPermissions(permissions);
    } catch {
      return false;
    }
  };

  // Common permission checks
  const canManageUsers = checkPermission('user:manage');
  const canViewUsers = checkPermission('user:read');
  const canManageRoles = checkPermission('role:manage');
  const canManageNetwork = checkPermission('network:manage');
  const canViewDashboard = checkPermission('dashboard:read');
  const isAdmin = checkRole('ADMIN') || checkRole('SUPER_ADMIN');
  const isSuperAdmin = checkRole('SUPER_ADMIN');

  return {
    user,
    hasPermission: checkPermission,
    hasRole: checkRole,
    hasAnyPermission: checkAnyPermission,
    hasAllPermissions: checkAllPermissions,
    // Convenience flags
    canManageUsers,
    canViewUsers,
    canManageRoles,
    canManageNetwork,
    canViewDashboard,
    isAdmin,
    isSuperAdmin,
  };
}

export default useAuth;