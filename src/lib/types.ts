export interface Vehicle {
  id: number;
  vin: string;
  stock_number: string | null;
  make: string;
  model: string;
  year: number;
  color: string | null;
  mileage: number | null;
  series: string | null;
  total_cost: number | null;
  selling_price: number | null;
  internet_price: number | null;
  status: "incoming" | "recon" | "parked" | "for_sale" | "not_for_sale" | "sold";
  smog_done: 0 | 1;
  detail_done: 0 | 1;
  inspected_done: 0 | 1;
  last_fb_post: string | null;
  reviewed_at: string | null;
  imported_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: number;
  vehicle_id: number;
  label: string;
  done: 0 | 1;
  done_at: string | null;
  sort_order: number;
}

export interface ImportLog {
  id: number;
  imported_at: string;
  vehicles_added: number;
  vehicles_removed: number;
  prices_changed: number;
  details: string | null;
}

export interface Sale {
  id: number;
  vin: string;
  stock_number: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  sold_price: number | null;
  total_cost: number | null;
  sold_date: string | null;
  buyer_name: string | null;
  imported_at: string;
}
