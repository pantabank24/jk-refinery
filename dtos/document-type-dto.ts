export interface DocumentTypeDto {
  id: number;
  name: string;
  code: string;
  sort_order: number;
  is_active: boolean;
  /** เอกสารสำคัญ — ลูกค้าลบไม่ได้ (เปลี่ยนได้) และทุกครั้งที่เปลี่ยนต้องให้พนักงานตรวจสอบ */
  is_high_priority: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentTypeRequest {
  name: string;
  code: string;
  sort_order: number;
  is_active: boolean;
  is_high_priority: boolean;
}
