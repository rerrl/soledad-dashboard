/**
 * Import service — diffs parsed CSV rows against the DB by stock_number.
 *
 * Returns a diff object. On apply, updates DB and logs changes.
 *
 * Comparison source: deskmanager_raw_data table (freshly reloaded from
 * the CSV by the route handler before computeDiff runs).
 */
import db from "./db";
import type { CsvVehicleRow } from "./csv-parser";
import type { VehicleStatus } from "./types";
import { mapDmToAppStatus } from "./dm-status-map";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiffType = "added" | "updated" | "flagged" | "removed";

export interface FieldChange {
  field: string;
  old_value: string | null;
  new_value: string | null;
}

export interface DiffItem {
  stock_number: string;
  vehicle_id?: number; // set for updated/flagged, undefined for added
  make: string;
  model: string;
  year: number;
  vin: string;
  changes: FieldChange[];
  diff_type: DiffType;
}

export interface ImportDiff {
  added: DiffItem[];
  updated: DiffItem[];
  flagged: DiffItem[];
  removed: DiffItem[];
  total: number;
  has_changes: boolean;
}

// ── Comparison helpers ─────────────────────────────────────────────────────────

/**
 * Fields to compare, mapping DM column → app column + value type.
 */
const FIELD_MAP: Array<{ dm: string; app: string; type: "string" | "number" | "sdi" }> = [
  { dm: "dm_make", app: "make", type: "string" },
  { dm: "dm_model", app: "model", type: "string" },
  { dm: "dm_year", app: "year", type: "number" },
  { dm: "dm_vin", app: "vin", type: "string" },
  { dm: "dm_color", app: "color", type: "string" },
  { dm: "dm_series", app: "series", type: "string" },
  { dm: "dm_mileage", app: "mileage", type: "number" },
  { dm: "dm_total_cost", app: "total_cost", type: "number" },
  { dm: "dm_selling_price", app: "selling_price", type: "number" },
  { dm: "dm_internet_price", app: "internet_price", type: "number" },
  { dm: "dm_smog", app: "smog_done", type: "sdi" },
  { dm: "dm_detail", app: "detail_done", type: "sdi" },
  { dm: "dm_inspected", app: "inspected_done", type: "sdi" },
];

/** Normalize a value for comparison: 0/0.00 → null (financial "not set"). */
function norm(val: unknown): unknown {
  if (val == null) return null;
  if (Number(val) === 0 || Number(val) === 0.0) return null;
  return val;
}

/**
 * Compare one field and, if different, push a FieldChange.
 */
function pushChange(
  changes: FieldChange[],
  appField: string,
  dmVal: unknown,
  appVal: unknown,
  type: "string" | "number" | "sdi",
): void {
  if (type === "sdi") {
    // Compare raw booleans — 0 and 1 are both meaningful
    const d = Number(dmVal);
    const a = Number(appVal);
    if (d !== a) {
      changes.push({ field: appField, old_value: String(a), new_value: String(d) });
    }
  } else if (type === "number") {
    // Financial/ numeric — 0 / 0.00 means "not set"
    const d = norm(dmVal);
    const a = norm(appVal);
    if (String(d ?? "") !== String(a ?? "")) {
      changes.push({
        field: appField,
        old_value: appVal != null ? String(appVal) : null,
        new_value: dmVal != null ? String(dmVal) : null,
      });
    }
  } else {
    // String fields
    const d = dmVal != null ? String(dmVal) : "";
    const a = appVal != null ? String(appVal) : "";
    if (d !== a) {
      changes.push({
        field: appField,
        old_value: appVal != null ? String(appVal) : null,
        new_value: dmVal != null ? String(dmVal) : null,
      });
    }
  }
}

// ── Diff logic ────────────────────────────────────────────────────────────────

export async function computeDiff(rows: CsvVehicleRow[]): Promise<ImportDiff> {
  // 1. Load all vehicles (the "app" side)
  const existingVehicles = await db("vehicles").select("*");
  const byStock: Record<string, any> = {};
  for (const v of existingVehicles) {
    if (v.stock_number) byStock[v.stock_number] = v;
  }

  // 2. Load all deskmanager_raw_data (the "DM" side — freshly reloaded)
  const dmRows = await db("deskmanager_raw_data").select("*");
  const byDmStock: Record<string, any> = {};
  for (const d of dmRows) {
    if (d.stock_number) byDmStock[d.stock_number] = d;
  }

  const csvStockNumbers = new Set(Object.keys(byDmStock));

  const added: DiffItem[] = [];
  const updated: DiffItem[] = [];

  // 3. For each vehicle in the CSV, check if it exists in the app
  for (const [stock, dmRow] of Object.entries(byDmStock)) {
    const appRow = byStock[stock];

    if (!appRow) {
      // In CSV/DM but not in app — added
      added.push({
        stock_number: stock,
        make: dmRow.dm_make ?? "",
        model: dmRow.dm_model ?? "",
        year: dmRow.dm_year ?? 0,
        vin: dmRow.dm_vin ?? "",
        changes: [],
        diff_type: "added",
      });
      continue;
    }

    // Both exist — check for differences
    const changes: FieldChange[] = [];

    // Status: compare mapped DM status vs app status
    const mappedStatus = mapDmToAppStatus(dmRow.dm_status, dmRow.dm_substatus);
    if (mappedStatus && mappedStatus !== appRow.status) {
      changes.push({
        field: "status",
        old_value: appRow.status,
        new_value: mappedStatus,
      });
    }

    // Compare all tracked fields
    for (const f of FIELD_MAP) {
      pushChange(changes, f.app, dmRow[f.dm], appRow[f.app], f.type);
    }

    if (changes.length > 0) {
      updated.push({
        stock_number: stock,
        vehicle_id: appRow.id,
        make: appRow.make,
        model: appRow.model,
        year: appRow.year,
        vin: appRow.vin,
        changes,
        diff_type: "updated",
      });
    }
  }

  // 4. Find vehicles in app that are NOT in the CSV — removed (sold)
  const removed: DiffItem[] = [];
  for (const [stock, v] of Object.entries(byStock)) {
    if (csvStockNumbers.has(stock)) continue;
    if (v.status === "sold") continue;
    removed.push({
      stock_number: stock,
      vehicle_id: v.id,
      make: v.make,
      model: v.model,
      year: v.year,
      vin: v.vin,
      changes: [],
      diff_type: "removed",
    });
  }

  return {
    added,
    updated,
    flagged: [],
    removed,
    total: added.length + updated.length + removed.length,
    has_changes: added.length > 0 || updated.length > 0 || removed.length > 0,
  };
}

// ── Apply diff ────────────────────────────────────────────────────────────────

export async function applyDiff(
  diff: ImportDiff,
  rows: CsvVehicleRow[],
): Promise<void> {
  // Load DM rows keyed by stock_number (fresh data just written by route)
  const dmAll = await db("deskmanager_raw_data").select("*");
  const byDmStock: Record<string, any> = {};
  for (const d of dmAll) byDmStock[d.stock_number] = d;

  const batchImportedAt = new Date().toISOString();

  // 1. Insert new vehicles
  for (const item of diff.added) {
    const dmRow = byDmStock[item.stock_number];
    if (!dmRow) continue;

    const [id] = await db("vehicles").insert({
      vin: dmRow.dm_vin ?? "",
      stock_number: dmRow.stock_number,
      make: dmRow.dm_make ?? "",
      model: dmRow.dm_model ?? "",
      year: dmRow.dm_year ?? 0,
      color: dmRow.dm_color,
      mileage: dmRow.dm_mileage,
      series: dmRow.dm_series,
      total_cost: dmRow.dm_total_cost,
      selling_price: dmRow.dm_selling_price,
      internet_price: dmRow.dm_internet_price,
      status: "incoming" as VehicleStatus,
      smog_done: dmRow.dm_smog ?? 0,
      detail_done: dmRow.dm_detail ?? 0,
      inspected_done: dmRow.dm_inspected ?? 0,
      imported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pics_taken: 0,
    });

    // Log the addition
    await db("change_log").insert({
      vehicle_id: id as number,
      stock_number: dmRow.stock_number,
      field_name: "vehicle_added",
      old_value: null,
      new_value: `${dmRow.dm_year ?? ""} ${dmRow.dm_make ?? ""} ${dmRow.dm_model ?? ""}`,
      change_type: "added",
      source: "csv_import",
      imported_at: batchImportedAt,
    });

    // Auto-create checklist items
    const CHECKLIST_TEMPLATES = [
      { label: "Post to FB Marketplace", sort_order: 5 },
    ];
    for (const t of CHECKLIST_TEMPLATES) {
      await db("vehicle_checklist_items").insert({
        vehicle_id: id as number,
        label: t.label,
        done: 0,
        done_at: null,
        sort_order: t.sort_order,
      });
    }

    // Apply status mapping
    const mappedStatus = mapDmToAppStatus(dmRow.dm_status, dmRow.dm_substatus);
    if (mappedStatus) {
      await db("vehicles").where("id", id).update({ status: mappedStatus });
    }
  }

  // 2. Update existing vehicles that have field changes
  for (const item of diff.updated) {
    if (!item.vehicle_id) continue;

    const updateData: Record<string, any> = {};
    for (const change of item.changes) {
      if (change.field === "smog_done" || change.field === "detail_done" || change.field === "inspected_done") {
        updateData[change.field] = change.new_value === "1" ? 1 : 0;
      } else if (change.field === "status") {
        updateData.status = change.new_value;
      } else if (change.new_value != null) {
        const numVal = Number(change.new_value);
        updateData[change.field] = isNaN(numVal) ? change.new_value : numVal;
      }
    }
    updateData.updated_at = new Date().toISOString();

    if (Object.keys(updateData).length > 0) {
      await db("vehicles").where("id", item.vehicle_id).update(updateData);
    }

    // Log each field change
    for (const change of item.changes) {
      await db("change_log").insert({
        vehicle_id: item.vehicle_id,
        stock_number: item.stock_number,
        field_name: change.field,
        old_value: change.old_value,
        new_value: change.new_value,
        change_type: "updated",
        source: "csv_import",
        imported_at: batchImportedAt,
      });
    }
  }

  // 3. Apply status mapping for ALL existing vehicles from the CSV
  for (const dmRow of dmAll) {
    const existing = await db("vehicles").where("stock_number", dmRow.stock_number).first();
    if (!existing) continue;

    const mappedStatus = mapDmToAppStatus(dmRow.dm_status, dmRow.dm_substatus);
    if (mappedStatus && mappedStatus !== existing.status) {
      await db("vehicles").where("id", existing.id).update({ status: mappedStatus });
      await db("change_log").insert({
        vehicle_id: existing.id,
        stock_number: dmRow.stock_number,
        field_name: "status",
        old_value: existing.status,
        new_value: mappedStatus,
        change_type: "updated",
        source: "csv_import",
        imported_at: batchImportedAt,
      });
    }
  }

  // 4. Mark removed vehicles as sold
  for (const item of diff.removed) {
    if (!item.vehicle_id) continue;
    await db("vehicles").where("id", item.vehicle_id).update({
      status: "sold" as VehicleStatus,
      updated_at: new Date().toISOString(),
    });
    await db("change_log").insert({
      vehicle_id: item.vehicle_id,
      stock_number: item.stock_number,
      field_name: "status",
      old_value: "active",
      new_value: "sold",
      change_type: "removed",
      source: "csv_import",
      imported_at: new Date().toISOString(),
    });
  }
}