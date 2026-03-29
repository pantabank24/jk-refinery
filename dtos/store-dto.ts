export interface StoreDto {
  id: number;
  code: string;
  name: string;
  address: string;
  phone: string;
  logo: string;
  is_active: boolean;
  branches?: BranchDto[];
  created_at: string;
  updated_at: string;
}

export interface BranchDto {
  id: number;
  store_id: number;
  code: string;
  name: string;
  address: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateStoreRequest {
  name: string;
  address?: string;
  phone?: string;
}

export interface CreateBranchRequest {
  name: string;
  address?: string;
  phone?: string;
}
