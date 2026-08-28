/**
 * Import service — diffs parsed CSV rows against the DB by stock_number.
 *
 * Returns a diff object. On apply, updates DB and logs changes.
 */
import db from "./db";
import type { CsvVehicleRow } from "./csv-parser";
import type { VehicleStatus } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiffType = "added" | "updated" | "flagged";

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
  total: number; // total vehicles affected
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

const S_D_I_FIELDS: Array<{ db: string; csv: (r: CsvVehicleRow) => string }> = [
  { db: "smog_done", csv: (r) => String(r.smog_done) },
  { db: "detail_done", csv: (r) => String(r.detail_done) },
  { db: "inspected_done", csv: (r) => String(r.inspected_done) },
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
  const flagged: DiffItem[] = [];

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

    // ── S/D/I conflict detection ──
    // CSV=1 wins (inherit), App=1 but CSV=0 gets flagged
    for (const f of S_D_I_FIELDS) {
      const dbVal = existingVehicle[f.db]; // 0 or 1 (number)
      const csvVal = f.csv(row); // "0" or "1" (string)

      if (csvVal === "1" && dbVal !== 1) {
        // DeskManager says done, App doesn't — inherit
        changes.push({ field: f.db, old_value: String(dbVal), new_value: "1" });
      } else if (csvVal !== "1" && dbVal === 1) {
        // App says done, DeskManager doesn't — flag it
        flagged.push({
          stock_number: row.stock_number,
          vehicle_id: existingVehicle.id,
          make: existingVehicle.make,
          model: existingVehicle.model,
          year: existingVehicle.year,
          vin: existingVehicle.vin,
          changes: [{ field: f.db, old_value: "1", new_value: "0" }],
          diff_type: "flagged",
        });
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

  // Merge flagged into updated or keep separate
  // A vehicle can appear in both updated and flagged — we keep them separate
  // in the diff object for the UI to display in different sections.

  return {
    added,
    updated,
    flagged,
    total: added.length + updated.length + flagged.length,
    has_changes: added.length > 0 || updated.length > 0 || flagged.length > 0,
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
      posted_to_fbm: 0,
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
      { label: "Smog check", sort_order: 1 },
      { label: "Detail", sort_order: 2 },
      { label: "Safety inspection", sort_order: 3 },
      { label: "Photos taken", sort_order: 4 },
      { label: "Posted to FB Marketplace", sort_order: 5 },
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
  }

  // 3. Log flagged items (App ahead of DeskManager)
  for (const item of diff.flagged) {
    if (!item.vehicle_id) continue;

    for (const change of item.changes) {
      await db("change_log").insert({
        vehicle_id: item.vehicle_id,
        stock_number: item.stock_number,
        field_name: change.field,
        old_value: change.old_value,
        new_value: change.new_value,
        change_type: "flagged",
        source: "csv_import",
        imported_at: batchImportedAt,
      });
    }
  }
}