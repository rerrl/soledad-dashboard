export type VehicleStatus =
  | "incoming"
  | "recon"
  | "parked"
  | "for_sale"
  | "not_for_sale"
  | "sold";

export interface DeskmanagerRow {
  id: number;
  stock_number: string;
  dm_status: string | null;
  dm_substatus: string | null;
  dm_smog: number | null;
  dm_detail: number | null;
  dm_inspected: number | null;
  dm_total_cost: number | null;
  dm_selling_price: number | null;
  dm_internet_price: number | null;
  dm_mileage: number | null;
  dm_series: string | null;
  dm_color: string | null;
  dm_year: number | null;
  dm_make: string | null;
  dm_model: string | null;
  dm_vin: string | null;
  imported_at: string;
}

export interface ChangeLogEntry {
  id: number;
  stock_number: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_type: string; // added | updated | removed
  viewed_at: string | null;
  source: string;
  imported_at: string;
  created_at: string;
  // Joined fields for display
  dm_make?: string | null;
  dm_model?: string | null;
  dm_year?: number | null;
}

export interface ChecklistItem {
  id: number;
  stock_number: string;
  label: string;
  done: 0 | 1;
  done_at: string | null;
  sort_order: number;
}

export interface VehicleSupplement {
  stock_number: string;
  pics_taken: 0 | 1;
  updated_at: string;
}