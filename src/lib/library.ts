// ─────────────────────────────────────────────────────────────────────────────
// Salesmen library — shared shapes and the pure filter/sort logic behind the
// `/dashboard` table.
//
// Everything here is deliberately free of React and of the database, so the
// two behaviours the page is judged on (token filtering and Excel-like column
// sorting) can be exercised directly:
//
//   - filtering is AND over whitespace-separated tokens, order-independent
//     ("Mazda 2024" ≡ "2024 mazda"), each token a case-insensitive substring of
//     ANY of vin / stock_number / make / model / year / series;
//   - sorting is per column with an asc/desc toggle, nulls last in both
//     directions, ties broken by stock number so the order is deterministic.
// ─────────────────────────────────────────────────────────────────────────────

/** One row of the salesmen library as returned by GET /api/vehicles/library. */
export type LibraryVehicle = {
  stock_number: string;
  dm_year: number | null;
  dm_make: string | null;
  dm_model: string | null;
  dm_series: string | null;
  dm_vin: string | null;
  dm_mileage: number | null;
  /** Selling price, already falling back to the internet price when null. */
  dm_selling_price: number | null;
  /** Days on lot. */
  dom: number | null;
};

/** Response body of GET /api/vehicles/library. */
export type LibraryResponse = {
  /** `imported_at` of the latest deskmanager_data batch (null when empty). */
  updatedAt: string | null;
  vehicles: LibraryVehicle[];
};

/** Sortable columns, in table order. */
export type SortKey =
  | "year"
  | "make"
  | "model"
  | "series"
  | "stock"
  | "vin"
  | "mileage"
  | "price"
  | "dom";

export type SortDirection = "asc" | "desc";

export const DEFAULT_SORT: { key: SortKey; direction: SortDirection } = {
  key: "dom",
  direction: "asc", // smallest days-on-lot first = newest arrival first
};

/** Split a filter query into lowercase tokens (whitespace-separated, AND'd). */
export function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** The fields a filter token is matched against, stringified for substring use. */
function searchableText(vehicle: LibraryVehicle): string[] {
  return [
    vehicle.dm_vin,
    vehicle.stock_number,
    vehicle.dm_make,
    vehicle.dm_model,
    vehicle.dm_year,
    vehicle.dm_series,
  ]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase());
}

/** True when EVERY token is a substring of at least one searchable field. */
export function matchesTokens(vehicle: LibraryVehicle, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const fields = searchableText(vehicle);
  return tokens.every((token) => fields.some((field) => field.includes(token)));
}

/** Filter the library client-side. An empty/blank query returns everything. */
export function filterVehicles(
  vehicles: LibraryVehicle[],
  query: string,
): LibraryVehicle[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return vehicles;
  return vehicles.filter((vehicle) => matchesTokens(vehicle, tokens));
}

/** The value a column sorts on. */
function sortValue(vehicle: LibraryVehicle, key: SortKey): string | number | null {
  switch (key) {
    case "year":
      return vehicle.dm_year;
    case "make":
      return vehicle.dm_make;
    case "model":
      return vehicle.dm_model;
    case "series":
      return vehicle.dm_series;
    case "stock":
      return vehicle.stock_number;
    case "vin":
      return vehicle.dm_vin;
    case "mileage":
      return vehicle.dm_mileage;
    case "price":
      return vehicle.dm_selling_price;
    case "dom":
      return vehicle.dom;
  }
}

/**
 * Sort a copy of the rows by one column.
 *
 * Nulls are always last (both directions) — an Excel-like "no surprises" rule
 * so flipping the direction never buries real values behind blanks. Ties fall
 * back to the stock number ascending, which keeps the order stable across
 * renders when (as here) duplicating batches exist.
 */
export function sortVehicles(
  vehicles: LibraryVehicle[],
  key: SortKey,
  direction: SortDirection,
): LibraryVehicle[] {
  const sign = direction === "asc" ? 1 : -1;

  return [...vehicles].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);

    if (av === null && bv === null) return compareStock(a, b);
    // Missing values sit at the bottom whichever way the column is sorted.
    if (av === null) return 1;
    if (bv === null) return -1;

    let comparison: number;
    if (typeof av === "number" && typeof bv === "number") {
      comparison = av - bv;
    } else {
      comparison = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }

    if (comparison !== 0) return comparison * sign;
    return compareStock(a, b);
  });
}

function compareStock(a: LibraryVehicle, b: LibraryVehicle): number {
  return String(a.stock_number).localeCompare(String(b.stock_number), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/** Format a price for the table, e.g. `$29,500`. */
export function formatPrice(value: number | null): string {
  return value === null || value === undefined
    ? "—"
    : `$${value.toLocaleString("en-US")}`;
}

/** Format a mileage reading, e.g. `58,420`. */
export function formatMileage(value: number | null): string {
  return value === null || value === undefined ? "—" : value.toLocaleString("en-US");
}

/**
 * Format the batch timestamp the way the header shows it, e.g.
 * `Oct 22, 2026 12:06 PM` (the browser's local timezone).
 */
export function formatUpdatedAt(updatedAt: string | null): string {
  if (!updatedAt) return "—";
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} ${time}`;
}
