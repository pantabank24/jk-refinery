export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  permissions: string[];
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  store_id: number | null;
  branch_id: number | null;
  role_id: number | null;
  store?: { id: number; code: string; name: string } | null;
  branch?: { id: number; code: string; name: string } | null;
  role?: { id: number; name: string; display_name: string } | null;
}
