// ── DeskManager Status Mapping ────────────────────────────────────────────
// Maps DM status/substatus combos to app statuses.
// TODO: Fill with actual DeskManager status/substatus values.
// Caller: used during CSV import to set initial vehicle swimlane.

import type { VehicleStatus } from "./types";

export function mapDmToAppStatus(
  dmStatus: string | null,
  dmSubstatus: string | null,
): VehicleStatus | null {
  if (dmStatus === "Recon") return "recon";
  if (dmStatus === "In Inventory") {
    switch (dmSubstatus) {
      case "Incoming":
        return "incoming";
      case "Parked":
        return "parked";
      case "Ready":
        return "for_sale";
      default:
        return null;
    }
  } else if (dmStatus === "Holding") return "not_for_sale";

  return null;
}
