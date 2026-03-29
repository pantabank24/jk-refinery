export interface RoleDto {
  id: number;
  name: string;
  display_name: string;
  description: string;
  is_system: boolean;
  permissions?: RolePermissionDto[];
  created_at: string;
  updated_at: string;
}

export interface RolePermissionDto {
  id: number;
  role_id: number;
  permission_id: number;
  permission: PermissionDto;
}

export interface PermissionDto {
  id: number;
  code: string;
  name: string;
  group_name: string;
  description: string;
}

export interface CreateRoleRequest {
  name: string;
  display_name: string;
  description?: string;
}

export interface SetPermissionsRequest {
  permission_ids: number[];
}
