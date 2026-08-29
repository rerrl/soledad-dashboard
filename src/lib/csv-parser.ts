/**
 * DeskManager CSV parser
 *
 * Expects columns (in any order, matched by header name after lowercasing):
 *   Required: stock num, make, model, vin
 *   Optional: year, exterior color, mileage, series, total cost,
 *             price asking, price internet, smog, detailed, safety,
 *             inventory date, status
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
  status: string | null;
  substatus: string | null;
  imported_at: string | null;
}

const COLUMN_ALIASES: Record<string, string> = {
  "stock num": "stock_number",
  "stock#": "stock_number",
  "stock #": "stock_number",
  "stock": "stock_number",
  "exterior color": "color",
  "exterior_color": "color",
  "price asking": "selling_price",
  "price_asking": "selling_price",
  "price internet": "internet_price",
  "price_internet": "internet_price",
  "inventory date": "imported_at",
  "inventory_date": "imported_at",
  "total cost": "total_cost",
  "total_cost": "total_cost",
  "detailed": "detail_done",
  "safety": "inspected_done",
  "smog": "smog_done",
};

/**
 * Normalize a CSV header: lowercase, trim, strip surrounding quotes,
 * collapse whitespace, then look up in alias map.
 */
function normalizeHeader(h: string): string {
  let cleaned = h.trim();
  // Strip surrounding quotes
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  // Lowercase and collapse internal whitespace
  cleaned = cleaned.toLowerCase().replace(/\s+/g, " ");
  // Look up alias
  return COLUMN_ALIASES[cleaned] ?? cleaned;
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
  const required = ["stock_number", "make", "model", "vin"];

  for (const col of required) {
    if (!headers.includes(col)) {
      throw new Error(`CSV missing required column: "${col}". Found: [${headers.join(", ")}]`);
    }
  }

  const idx = (name: string) => {
    const i = headers.indexOf(name);
    return i >= 0 ? i : -1;
  };

  const rows: CsvVehicleRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const stockIdx = idx("stock_number");
    const stock = stockIdx >= 0 ? (cols[stockIdx] ?? "").trim() : "";

    if (!stock) continue; // skip empty rows

    const yearIdx = idx("year");
    const makeIdx = idx("make");
    const modelIdx = idx("model");
    const vinIdx = idx("vin");
    const colorIdx = idx("color");
    const mileageIdx = idx("mileage");
    const seriesIdx = idx("series");
    const totalCostIdx = idx("total_cost");
    const sellingPriceIdx = idx("selling_price");
    const internetPriceIdx = idx("internet_price");
    const smogIdx = idx("smog_done");
    const detailIdx = idx("detail_done");
    const inspectedIdx = idx("inspected_done");
    const importedAtIdx = idx("imported_at");
    const statusIdx = idx("status");
    const substatusIdx = idx("substatus");

    rows.push({
      stock_number: stock,
      year: yearIdx >= 0 ? parseInt(cols[yearIdx] || "0", 10) || 0 : 0,
      make: makeIdx >= 0 ? cols[makeIdx] || "" : "",
      model: modelIdx >= 0 ? cols[modelIdx] || "" : "",
      vin: vinIdx >= 0 ? cols[vinIdx] || "" : "",
      color: colorIdx >= 0 ? cols[colorIdx] || null : null,
      mileage: mileageIdx >= 0 ? parseNum(cols[mileageIdx]) : null,
      series: seriesIdx >= 0 ? cols[seriesIdx] || null : null,
      total_cost: totalCostIdx >= 0 ? parseNum(cols[totalCostIdx]) : null,
      selling_price: sellingPriceIdx >= 0 ? parseNum(cols[sellingPriceIdx]) : null,
      internet_price: internetPriceIdx >= 0 ? parseNum(cols[internetPriceIdx]) : null,
      smog_done: smogIdx >= 0 ? parseIntBool(cols[smogIdx]) : 0,
      detail_done: detailIdx >= 0 ? parseIntBool(cols[detailIdx]) : 0,
      inspected_done: inspectedIdx >= 0 ? parseIntBool(cols[inspectedIdx]) : 0,
      status: statusIdx >= 0 ? cols[statusIdx] || null : null,
      substatus: substatusIdx >= 0 ? cols[substatusIdx] || null : null,
      imported_at: importedAtIdx >= 0 ? normalizeDate(cols[importedAtIdx] ?? null) : null,
    });
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields properly.
 */
/**
 * Normalize a date string to ISO format (YYYY-MM-DD).
 * Handles MM/DD/YYYY, M/D/YYYY, and already-ISO strings.
 */
function normalizeDate(val: string | null): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  // Already ISO? (starts with 4-digit year)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed;
  // MM/DD/YYYY or M/D/YYYY
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const mm = mdy[1].padStart(2, "0");
    const dd = mdy[2].padStart(2, "0");
    return `${mdy[3]}-${mm}-${dd}`;
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result.map((s) => s.trim());
}