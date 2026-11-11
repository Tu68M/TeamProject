import { api } from "@shared/api/axiosInstance";
import type {
  AuthResponse,
  CreateRoleRequest,
  UpdateRoleRequest,
  LoginRequest,
  ModulePermissionEntry,
  ModulePermissionRequest,
  ModuleResponse,
  PageUserResponse,
  Pageable,
  PermissionResponse,
  PermissionsEditRequest,
  RolePermissionResponse,
  RoleResponse,
  RoleShortResponse,
  UpdateUserRolesInner,
  UserContextResponse,
  UserFullResponse,
  UserResponse,
  UserStatus,
} from "@shared/types/api";

export const userApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>("/api/v1/auth/login", data);
    return response.data;
  },
  getContext: async (): Promise<UserContextResponse> => {
    const response = await api.get<UserContextResponse>("/api/v1/users/me/context");
    return response.data;
  },
  refresh: async (): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>("/api/v1/auth/refresh");
    return data;
  },

  refreshToken: async (): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>("/api/v1/auth/refresh");
    return data;
  },

  logout: async (): Promise<void> => {
    await api.post("/api/v1/auth/logout");
  },

  getMe: async (): Promise<UserFullResponse> => {
    const { data } = await api.get<UserFullResponse>("/api/v1/users/me");
    return data;
  },
  getUsers: async (params?: Pageable): Promise<PageUserResponse> => {
    const response = await api.get<PageUserResponse>("/api/v1/users", { params });
    return response.data;
  },

  getUserById: async (userId: string): Promise<UserResponse> => {
    const response = await api.get<UserResponse>(`/api/v1/users/${userId}`);
    return response.data;
  },

  getUserByEmployeeUid: async (employeeUid: string): Promise<UserResponse> => {
    const response = await api.get<UserResponse>(`/api/v1/users/by-employee/${employeeUid}`);
    return response.data;
  },

  searchUsers: async (query: string, params?: Pageable): Promise<PageUserResponse> => {
    const response = await api.get<PageUserResponse>("/api/v1/users/search", {
      params: { query, ...params },
    });
    return response.data;
  },

  updateUserRoles: async (userId: string, data: UpdateUserRolesInner): Promise<UserResponse> => {
    const response = await api.patch<UserResponse>(`/api/v1/users/${userId}/roles`, data);
    return response.data;
  },

  updateUserStatus: async (userId: string, newStatus: UserStatus, until?: string): Promise<void> => {
    await api.patch(`/api/v1/users/${userId}/status`, null, {
      params: { newStatus, until },
    });
  },

  getRoles: async (): Promise<RoleShortResponse[]> => {
    const response = await api.get<RoleShortResponse[]>("/api/v1/roles");
    return response.data;
  },

  createRole: async (data: CreateRoleRequest): Promise<RoleResponse> => {
    const response = await api.post<RoleResponse>("/api/v1/roles", data);
    return response.data;
  },

  updateRole: async (roleId: string, data: UpdateRoleRequest): Promise<RoleResponse> => {
    const response = await api.patch<RoleResponse>(`/api/v1/roles/${roleId}`, data);
    return response.data;
  },

  getRoleById: async (roleId: string): Promise<RoleResponse> => {
    const response = await api.get<RoleResponse>(`/api/v1/roles/${roleId}`);
    return response.data;
  },

  updateRolePermissions: async (
    roleId: string,
    data: PermissionsEditRequest
  ): Promise<RolePermissionResponse> => {
    const response = await api.patch<RolePermissionResponse>(
      `/api/v1/roles/${roleId}/permissions`,
      data
    );
    return response.data;
  },

  getAllPermissions: async (): Promise<PermissionResponse[]> => {
    const response = await api.get<PermissionResponse[]>("/api/v1/permissions");
    return response.data;
  },

  getModules: async (): Promise<ModuleResponse[]> => {
    const response = await api.get<ModuleResponse[]>("/api/v1/modules");
    return response.data;
  },

  getModulePermissions: async (moduleCode: string): Promise<ModulePermissionEntry[]> => {
    const response = await api.get<ModulePermissionEntry[]>(`/api/v1/modules/${moduleCode}/permissions`);
    return response.data;
  },

  setModulePermissions: async (
    moduleCode: string,
    entries: ModulePermissionRequest[]
  ): Promise<void> => {
    await api.put(`/api/v1/modules/${moduleCode}/permissions`, entries);
  },

  uploadMyAvatar: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("avatar", file);
    const response = await api.post<string>("/api/v1/users/my-avatar", formData, {
      headers: { "Content-Type": undefined },
    });
    return response.data;
  },

  deleteMyAvatar: async (): Promise<void> => {
    await api.delete("/api/v1/users/my-avatar");
  },

  employeeAvatarUrl: (employeeUid: string): string => `/api/v1/users/by-employee/${employeeUid}/avatar`,
};