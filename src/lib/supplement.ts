/**
 * Shared config for the vehicle "supplement" fields — the post-deskmanager set
 * of per-vehicle booleans that DeskManager doesn't track (Pics Taken + the
 * physical-paperwork items that follow it).
 *
 * `dbColumn` is the actual column name on `vehicle_supplement` and is the ONLY
 * value accepted by the /api/supplement endpoint (whitelist guards SQLi).
 * `short` is the compact label used in the print form (S/D/I/P/F/AC/BG/WS).
 */

export interface SupplementField {
  dbColumn: string;
  short: string;
  label: string;
}

export const SUPPLEMENT_FIELDS: SupplementField[] = [
  { dbColumn: "pics_taken", short: "P", label: "Pics Taken" },
  { dbColumn: "folder", short: "F", label: "Folder" },
  { dbColumn: "account_center", short: "AC", label: "Account Center" },
  { dbColumn: "buyers_guide", short: "BG", label: "Buyers Guide" },
  { dbColumn: "window_sticker", short: "WS", label: "Window Sticker" },
];

/** Whitelist of updatable column names — the route rejects anything else. */
export const SUPPLEMENT_COLUMNS = SUPPLEMENT_FIELDS.map((f) => f.dbColumn);

/** A mapping of dbColumn -> 0|1 for a vehicle's current supplement state. */
export type SupplementValues = Record<string, 0 | 1>;