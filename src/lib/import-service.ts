/**
 * Import service — diffs parsed CSV rows against the DB by stock_number.
 *
 * Returns a diff object. On apply, updates DB and logs changes.
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

// ── Field map ─────────────────────────────────────────────────────────────────

const CSV_FIELDS: Array<{ db: string; csv: (r: CsvVehicleRow) => string | null }> = [
  { db: "mileage", csv: (r) => (r.mileage != null ? String(r.mileage) : null) },
  { db: "total_cost", csv: (r) => (r.total_cost != null ? String(r.total_cost) : null) },
  { db: "selling_price", csv: (r) => (r.selling_price != null ? String(r.selling_price) : null) },
  { db: "internet_price", csv: (r) => (r.internet_price != null ? String(r.internet_price) : null) },
  { db: "color", csv: (r) => r.color },
  { db: "series", csv: (r) => r.series },
  { db: "year", csv: (r) => String(r.year) },
  { db: "make", csv: (r) => r.make },
  { db: "model", csv: (r) => r.model },
  { db: "vin", csv: (r) => r.vin },
];

// ── Diff logic ────────────────────────────────────────────────────────────────

export async function computeDiff(rows: CsvVehicleRow[]): Promise<ImportDiff> {
  // Fetch all vehicles keyed by stock_number for quick lookup
  const existing = await db("vehicles").select("*");
  const byStock: Record<string, any> = {};
  for (const v of existing) {
    if (v.stock_number) byStock[v.stock_number] = v;
  }

  const added: DiffItem[] = [];
  const updated: DiffItem[] = [];

  // Track stock numbers seen in CSV to detect duplicates within CSV
  const seen: Set<string> = new Set();

  for (const row of rows) {
    // Skip duplicate stock_numbers within the same CSV
    if (seen.has(row.stock_number)) continue;
    seen.add(row.stock_number);

    const existingVehicle = byStock[row.stock_number];

    if (!existingVehicle) {
      // New vehicle — added
      added.push({
        stock_number: row.stock_number,
        make: row.make,
        model: row.model,
        year: row.year,
        vin: row.vin,
        changes: [],
        diff_type: "added",
      });
      continue;
    }

    // Existing vehicle — check CSV fields for updates
    const changes: FieldChange[] = [];

    for (const f of CSV_FIELDS) {
      const dbVal = existingVehicle[f.db] != null ? String(existingVehicle[f.db]) : null;
      const csvVal = f.csv(row);

      // Normalize comparison — "0" and null both mean "not set"
      const dbNorm = dbVal === "0" || dbVal === "0.00" ? null : dbVal;
      const csvNorm = csvVal === "0" || csvVal === "0.00" ? null : csvVal;

      if (csvNorm !== dbNorm) {
        // Only flag as changed if the CSV value is non-null (CSV provides a real value)
        if (csvNorm != null) {
          changes.push({ field: f.db, old_value: dbVal, new_value: csvVal });
        }
      }
    }

    if (changes.length > 0) {
      updated.push({
        stock_number: row.stock_number,
        vehicle_id: existingVehicle.id,
        make: existingVehicle.make,
        model: existingVehicle.model,
        year: existingVehicle.year,
        vin: existingVehicle.vin,
        changes,
        diff_type: "updated",
      });
    }
  }

  // Find vehicles in DB that weren't in the CSV — mark as removed (to be sold)
  const removed: DiffItem[] = [];
  for (const [stock, v] of Object.entries(byStock)) {
    if (seen.has(stock)) continue;
    if (v.status === "sold") continue; // already sold
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
  rows: CsvVehicleRow[]
): Promise<void> {
  const byStock: Record<string, CsvVehicleRow> = {};
  for (const row of rows) byStock[row.stock_number] = row;

  // Shared batch timestamp — all entries from one import share this
  const batchImportedAt = new Date().toISOString();

  async function saveDmSnapshot(row: CsvVehicleRow, snappedAt: string): Promise<number> {
    // Delete existing snapshot for this stock_number, then insert new one
    await db("deskmanager_raw_data").where("stock_number", row.stock_number).del();
    const [id] = await db("deskmanager_raw_data").insert({
      stock_number: row.stock_number,
      dm_status: row.status,
      dm_substatus: row.substatus,
      dm_smog: row.smog_done,
      dm_detail: row.detail_done,
      dm_inspected: row.inspected_done,
      dm_total_cost: row.total_cost,
      dm_selling_price: row.selling_price,
      dm_internet_price: row.internet_price,
      dm_mileage: row.mileage,
      dm_series: row.series,
      dm_color: row.color,
      dm_year: row.year,
      dm_make: row.make,
      dm_model: row.model,
      dm_vin: row.vin,
      snapped_at: snappedAt,
    });
    return id as number;
  }

  // 1. Insert new vehicles
  for (const item of diff.added) {
    const row = byStock[item.stock_number];
    if (!row) continue;

    const [id] = await db("vehicles").insert({
      vin: row.vin,
      stock_number: row.stock_number,
      make: row.make,
      model: row.model,
      year: row.year,
      color: row.color,
      mileage: row.mileage,
      series: row.series,
      total_cost: row.total_cost,
      selling_price: row.selling_price,
      internet_price: row.internet_price,
      status: "incoming" as VehicleStatus,
      smog_done: row.smog_done,
      detail_done: row.detail_done,
      inspected_done: row.inspected_done,
      imported_at: row.imported_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pics_taken: 0,
    });

    // Log the addition
    await db("change_log").insert({
      vehicle_id: id as number,
      stock_number: row.stock_number,
      field_name: "vehicle_added",
      old_value: null,
      new_value: `${row.year} ${row.make} ${row.model}`,
      change_type: "added",
      source: "csv_import",
      imported_at: batchImportedAt,
    });

    // Auto-create checklist items for new incoming vehicles
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

    // Write DM snapshot and apply status mapping
    const snapId = await saveDmSnapshot(row, batchImportedAt);
    await db("vehicles").where("id", id).update({ deskmanager_data_id: snapId });
    const mappedStatus = mapDmToAppStatus(row.status, row.substatus);
    if (mappedStatus) {
      await db("vehicles").where("id", id).update({ status: mappedStatus });
    }
  }

  // 2. Update existing vehicles
  for (const item of diff.updated) {
    if (!item.vehicle_id) continue;
    const row = byStock[item.stock_number];
    if (!row) continue;

    const updateData: Record<string, any> = {};
    for (const change of item.changes) {
      // For S/D/I where CSV=1 wins, set it
      if (["smog_done", "detail_done", "inspected_done"].includes(change.field) && change.new_value === "1") {
        updateData[change.field] = 1;
      } else if (!["smog_done", "detail_done", "inspected_done"].includes(change.field)) {
        // Standard CSV fields — only apply if new_value is not null
        if (change.new_value != null) {
          const numVal = Number(change.new_value);
          updateData[change.field] = isNaN(numVal) ? change.new_value : numVal;
        }
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

    // Write updated DM snapshot
    const snapId = await saveDmSnapshot(row, batchImportedAt);
    await db("vehicles").where("id", item.vehicle_id).update({ deskmanager_data_id: snapId });
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