/**
 * DeskManager CSV parser
 *
 * Expects columns (in any order, matched by header name):
 *   stock#, year, make, model, vin, color, mileage, series,
 *   total_cost, selling_price, internet_price, smog_done,
 *   detail_done, inspected_done, imported_at
 *
 * Returns a typed array of parsed vehicle records.
 */

export interface CsvVehicleRow {
  stock_number: string;
  year: number;
  make: string;
  model: string;
  vin: string;
  color: string | null;
  mileage: number | null;
  series: string | null;
  total_cost: number | null;
  selling_price: number | null;
  internet_price: number | null;
  smog_done: number;
  detail_done: number;
  inspected_done: number;
  imported_at: string | null;
}

const COLUMN_ALIASES: Record<string, string> = {
  stock: "stock_number",
  "stock#": "stock_number",
  "stock #": "stock_number",
};

function normalizeHeader(h: string): string {
  const lower = h.trim().toLowerCase().replace(/[^a-z0-9_#]/g, "");
  return COLUMN_ALIASES[lower] ?? lower;
}

function parseNum(val: string | undefined): number | null {
  if (!val || val.trim() === "") return null;
  const cleaned = val.trim().replace(/[,$]/g, "");
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

function parseIntBool(val: string | undefined): number {
  if (!val || val.trim() === "") return 0;
  const cleaned = val.trim().toLowerCase();
  if (cleaned === "1" || cleaned === "yes" || cleaned === "true" || cleaned === "y") return 1;
  return 0;
}

export function parseCsv(text: string): CsvVehicleRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }

  // Parse header row — find column index by normalizing
  const headers = lines[0].split(",").map((h) => normalizeHeader(h));
  const required = ["stock_number", "year", "make", "model", "vin"];

  for (const col of required) {
    if (!headers.includes(col)) {
      throw new Error(`CSV missing required column: "${col}"`);
    }
  }

  const idx = (name: string) => headers.indexOf(name);

  const rows: CsvVehicleRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const stock = cols[idx("stock_number")];

    if (!stock || stock === "") continue; // skip empty rows

    rows.push({
      stock_number: stock,
      year: parseInt(cols[idx("year")] || "0", 10) || 0,
      make: cols[idx("make")] || "",
      model: cols[idx("model")] || "",
      vin: cols[idx("vin")] || "",
      color: cols[idx("color")] || null,
      mileage: parseNum(cols[idx("mileage")]),
      series: cols[idx("series")] || null,
      total_cost: parseNum(cols[idx("total_cost")]),
      selling_price: parseNum(cols[idx("selling_price")]),
      internet_price: parseNum(cols[idx("internet_price")]),
      smog_done: parseIntBool(cols[idx("smog_done")]),
      detail_done: parseIntBool(cols[idx("detail_done")]),
      inspected_done: parseIntBool(cols[idx("inspected_done")]),
      imported_at: cols[idx("imported_at")] || null,
    });
  }

  return rows;
}