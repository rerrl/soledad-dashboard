// ── DeskManager Status Mapping ────────────────────────────────────────────
// Maps DM status/substatus combos to app statuses.
// TODO: Fill with actual DeskManager status/substatus values.
// Caller: used during CSV import to set initial vehicle swimlane.

import type { VehicleStatus } from "./types";

type StatusMap = Record<string, Record<string, VehicleStatus | null>>;

export function mapDmToAppStatus(
  dmStatus: string | null,
  dmSubstatus: string | null,
): VehicleStatus | null {
  if (dmStatus === "Recon") {
    if (dmSubstatus === "Hold") return "parked";
    return "recon";
  } else if (dmStatus === "In Inventory") {
    if (dmSubstatus === "Ready") return "for_sale";
    return "incoming";
  } else if (dmStatus === "Holding") return "not_for_sale"
  return null;
}
