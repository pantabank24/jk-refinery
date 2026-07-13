export interface BankDto {
  id: number;
  name: string;
  code: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BankRequest {
  name: string;
  code: string;
  sort_order: number;
  is_active: boolean;
}
