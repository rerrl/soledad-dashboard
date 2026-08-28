// ── DeskManager Status Mapping ────────────────────────────────────────────
// Maps DM status/substatus combos to app statuses.
// TODO: Fill with actual DeskManager status/substatus values.
// Caller: used during CSV import to set initial vehicle swimlane.

import type { VehicleStatus } from "./types";

type StatusMap = Record<string, Record<string, VehicleStatus | null>>;

const DM_TO_APP_STATUS: StatusMap = {
  // dm_status: { dm_substatus (or "" for none) → app_status }
  //
  // Example:
  // "Available":    { "": "for_sale", "On Hold": "not_for_sale" },
  // "In Service":   { "": "recon", "Smog": "recon", "Detail": "recon", "Safety": "recon" },
  // "Sold":         { "": "sold" },
  // "Inactive":     { "": "parked" },
  // "Pending Arrival": { "": "incoming" },
};

export function mapDmToAppStatus(
  dmStatus: string | null,
  dmSubstatus: string | null
): VehicleStatus | null {
  if (!dmStatus) return null;
  const subMap = DM_TO_APP_STATUS[dmStatus];
  if (!subMap) return null;
  return subMap[dmSubstatus ?? ""] ?? null;
}