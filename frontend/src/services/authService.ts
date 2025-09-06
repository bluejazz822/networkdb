import { apiClient } from '@/utils/api';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  MfaSetupResponse,
  MfaVerifyRequest,
  User,
  ApiResponse,
  PaginatedResponse,
  UserSession,
  SecurityEvent,
  UserListFilter,
  CreateUserRequest,
  UpdateUserRequest,
  Role,
  Permission,
  CreateRoleRequest,
  UpdateRoleRequest,
  CreatePermissionRequest,
} from '@/types/index';

/**
 * Authentication Service
 * Handles all authentication-related API calls
 */
export const authService = {
  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    return response;
  },

  async register(userData: RegisterRequest): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<{ message: string }>('/auth/register', userData);
    return response;
  },

  async logout(): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<{ message: string }>('/auth/logout');
    return response;
  },

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/refresh', { refreshToken });
    return response;
  },

  async me(): Promise<ApiResponse<User>> {
    const response = await apiClient.get<User>('/auth/me');
    return response;
  },

  // Password management
  async forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<{ message: string }>('/auth/forgot-password', data);
    return response;
  },

  async resetPassword(data: ResetPasswordRequest): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<{ message: string }>('/auth/reset-password', data);
    return response;
  },

  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<{ message: string }>('/auth/change-password', data);
    return response;
  },

  // Profile management
  async updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<User>> {
    const response = await apiClient.put<User>('/auth/profile', data);
    return response;
  },

  async verifyEmail(token: string): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<{ message: string }>('/auth/verify-email', { token });
    return response;
  },

  async resendVerificationEmail(): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<{ message: string }>('/auth/resend-verification');
    return response;
  },

  // Multi-factor authentication
  async setupMfa(): Promise<ApiResponse<MfaSetupResponse>> {
    const response = await apiClient.post<MfaSetupResponse>('/auth/mfa/setup');
    return response;
  },

  async verifyMfa(data: MfaVerifyRequest): Promise<ApiResponse<{ message: string; backupCodes?: string[] }>> {
    const response = await apiClient.post<{ message: string; backupCodes?: string[] }>('/auth/mfa/verify', data);
    return response;
  },

  async disableMfa(data: { password: string; token: string }): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<{ message: string }>('/auth/mfa/disable', data);
    return response;
  },

  // Session management
  async getSessions(): Promise<ApiResponse<UserSession[]>> {
    const response = await apiClient.get<UserSession[]>('/auth/sessions');
    return response;
  },

  async revokeSession(sessionId: string): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.delete<{ message: string }>(`/auth/sessions/${sessionId}`);
    return response;
  },

  async revokeAllSessions(): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.delete<{ message: string }>('/auth/sessions');
    return response;
  },

  // Security events
  async getSecurityEvents(page = 1, limit = 20): Promise<ApiResponse<PaginatedResponse<SecurityEvent>>> {
    const response = await apiClient.get<PaginatedResponse<SecurityEvent>>(`/auth/security-events?page=${page}&limit=${limit}`);
    return response;
  },
};

/**
 * User Management Service
 * Handles admin user management operations
 */
export const userManagementService = {
  // User CRUD operations
  async getUsers(filter?: UserListFilter, page = 1, limit = 20): Promise<ApiResponse<PaginatedResponse<User>>> {
    const params = new URLSearchParams();
    if (filter?.search) params.append('search', filter.search);
    if (filter?.isActive !== undefined) params.append('isActive', filter.isActive.toString());
    if (filter?.isEmailVerified !== undefined) params.append('isEmailVerified', filter.isEmailVerified.toString());
    if (filter?.roles?.length) params.append('roles', filter.roles.join(','));
    if (filter?.createdAfter) params.append('createdAfter', filter.createdAfter);
    if (filter?.createdBefore) params.append('createdBefore', filter.createdBefore);
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await apiClient.get<PaginatedResponse<User>>(`/admin/users?${params.toString()}`);
    return response;
  },

  async getUser(userId: string): Promise<ApiResponse<User>> {
    const response = await apiClient.get<User>(`/admin/users/${userId}`);
    return response;
  },

  async createUser(userData: CreateUserRequest): Promise<ApiResponse<User>> {
    const response = await apiClient.post<User>('/admin/users', userData);
    return response;
  },

  async updateUser(userId: string, userData: UpdateUserRequest): Promise<ApiResponse<User>> {
    const response = await apiClient.put<User>(`/admin/users/${userId}`, userData);
    return response;
  },

  async deleteUser(userId: string): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.delete<{ message: string }>(`/admin/users/${userId}`);
    return response;
  },

  async lockUser(userId: string): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<{ message: string }>(`/admin/users/${userId}/lock`);
    return response;
  },

  async unlockUser(userId: string): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<{ message: string }>(`/admin/users/${userId}/unlock`);
    return response;
  },

  async resetUserPassword(userId: string): Promise<ApiResponse<{ temporaryPassword: string }>> {
    const response = await apiClient.post<{ temporaryPassword: string }>(`/admin/users/${userId}/reset-password`);
    return response;
  },

  // Bulk operations
  async bulkUpdateUsers(userIds: string[], updates: Partial<UpdateUserRequest>): Promise<ApiResponse<{ updated: number }>> {
    const response = await apiClient.post<{ updated: number }>('/admin/users/bulk-update', { userIds, updates });
    return response;
  },

  async bulkDeleteUsers(userIds: string[]): Promise<ApiResponse<{ deleted: number }>> {
    const response = await apiClient.post<{ deleted: number }>('/admin/users/bulk-delete', { userIds });
    return response;
  },
};

/**
 * Role Management Service
 * Handles role and permission management operations
 */
export const roleManagementService = {
  // Role CRUD operations
  async getRoles(page = 1, limit = 50): Promise<ApiResponse<PaginatedResponse<Role>>> {
    const response = await apiClient.get<PaginatedResponse<Role>>(`/admin/roles?page=${page}&limit=${limit}`);
    return response;
  },

  async getRole(roleId: string): Promise<ApiResponse<Role>> {
    const response = await apiClient.get<Role>(`/admin/roles/${roleId}`);
    return response;
  },

  async createRole(roleData: CreateRoleRequest): Promise<ApiResponse<Role>> {
    const response = await apiClient.post<Role>('/admin/roles', roleData);
    return response;
  },

  async updateRole(roleId: string, roleData: UpdateRoleRequest): Promise<ApiResponse<Role>> {
    const response = await apiClient.put<Role>(`/admin/roles/${roleId}`, roleData);
    return response;
  },

  async deleteRole(roleId: string): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.delete<{ message: string }>(`/admin/roles/${roleId}`);
    return response;
  },

  // Permission management for roles
  async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<{ message: string }>(`/admin/roles/${roleId}/permissions`, { permissionIds });
    return response;
  },

  async removePermissionsFromRole(roleId: string, permissionIds: string[]): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.delete<{ message: string }>(`/admin/roles/${roleId}/permissions`, { data: { permissionIds } });
    return response;
  },

  // Role assignment to users
  async assignRolesToUser(userId: string, roleIds: string[]): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.post<{ message: string }>(`/admin/users/${userId}/roles`, { roleIds });
    return response;
  },

  async removeRolesFromUser(userId: string, roleIds: string[]): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.delete<{ message: string }>(`/admin/users/${userId}/roles`, { data: { roleIds } });
    return response;
  },
};

/**
 * Permission Management Service
 * Handles permission management operations
 */
export const permissionManagementService = {
  // Permission CRUD operations
  async getPermissions(page = 1, limit = 100): Promise<ApiResponse<PaginatedResponse<Permission>>> {
    const response = await apiClient.get<PaginatedResponse<Permission>>(`/admin/permissions?page=${page}&limit=${limit}`);
    return response;
  },

  async getPermission(permissionId: string): Promise<ApiResponse<Permission>> {
    const response = await apiClient.get<Permission>(`/admin/permissions/${permissionId}`);
    return response;
  },

  async createPermission(permissionData: CreatePermissionRequest): Promise<ApiResponse<Permission>> {
    const response = await apiClient.post<Permission>('/admin/permissions', permissionData);
    return response;
  },

  async updatePermission(permissionId: string, permissionData: Partial<CreatePermissionRequest>): Promise<ApiResponse<Permission>> {
    const response = await apiClient.put<Permission>(`/admin/permissions/${permissionId}`, permissionData);
    return response;
  },

  async deletePermission(permissionId: string): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.delete<{ message: string }>(`/admin/permissions/${permissionId}`);
    return response;
  },

  // Permission groups and resources
  async getPermissionsByResource(): Promise<ApiResponse<Record<string, Permission[]>>> {
    const response = await apiClient.get<Record<string, Permission[]>>('/admin/permissions/by-resource');
    return response;
  },

  async getAvailableResources(): Promise<ApiResponse<string[]>> {
    const response = await apiClient.get<string[]>('/admin/permissions/resources');
    return response;
  },

  async getAvailableActions(): Promise<ApiResponse<string[]>> {
    const response = await apiClient.get<string[]>('/admin/permissions/actions');
    return response;
  },
};