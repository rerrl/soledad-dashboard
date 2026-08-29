import { NextResponse } from "next/server";
import db from "@/lib/db";
import { mapDmToAppStatus } from "@/lib/dm-status-map";

export async function GET() {
  // Get the latest DeskManager snapshot per stock_number, joined to vehicles
  const rows = await db
    .with("latest_dm", (qb) => {
      qb.select(
        "stock_number",
        "dm_status",
        "dm_substatus",
        "dm_smog",
        "dm_detail",
        "dm_inspected",
        "snapped_at",
        "dm_vin",
        "dm_year",
        "dm_make",
        "dm_model",
      )
        .from("deskmanager_raw_data")
        .whereIn(
          ["stock_number", "snapped_at"],
          db
            .select("stock_number", db.raw("MAX(snapped_at) as snapped_at"))
            .from("deskmanager_raw_data")
            .groupBy("stock_number"),
        );
    })
    .select(
      "latest_dm.stock_number",
      "latest_dm.dm_status",
      "latest_dm.dm_substatus",
      "latest_dm.dm_smog",
      "latest_dm.dm_detail",
      "latest_dm.dm_inspected",
      "latest_dm.snapped_at",
      "latest_dm.dm_vin as vin",
      "latest_dm.dm_year as year",
      "latest_dm.dm_make as make",
      "latest_dm.dm_model as model",
      "vehicles.status as app_status",
      "vehicles.smog_done as app_smog",
      "vehicles.detail_done as app_detail",
      "vehicles.inspected_done as app_inspected",
    )
    .from("latest_dm")
    .leftJoin(
      "vehicles",
      "latest_dm.stock_number",
      "vehicles.stock_number",
    );

  const mismatches = rows
    .map((row: Record<string, any>) => {
      // Skip vehicles that don't exist in the app at all
      if (row.app_status == null && row.app_smog == null && row.app_detail == null && row.app_inspected == null) {
        return null;
      }

      const dmMappedStatus = mapDmToAppStatus(row.dm_status, row.dm_substatus);
      const diffFields: string[] = [];

      // Normalize S/D/I to numbers for safe comparison (DM may store as strings)
      const toNum = (v: unknown) => (v == null ? null : Number(v));
      const appSmogN = toNum(row.app_smog);
      const appDetailN = toNum(row.app_detail);
      const appInspectedN = toNum(row.app_inspected);
      const dmSmogN = toNum(row.dm_smog);
      const dmDetailN = toNum(row.dm_detail);
      const dmInspectedN = toNum(row.dm_inspected);

      const smogEqual = dmSmogN === appSmogN;
      const detailEqual = dmDetailN === appDetailN;
      const inspectedEqual = dmInspectedN === appInspectedN;
      const statusEqual = dmMappedStatus === row.app_status;

      if (!smogEqual) diffFields.push("smog");
      if (!detailEqual) diffFields.push("detail");
      if (!inspectedEqual) diffFields.push("inspected");
      if (!statusEqual) diffFields.push("status");

      if (diffFields.length === 0) return null;

      return {
        stock_number: row.stock_number,
        vin: row.vin,
        year: row.year,
        make: row.make,
        model: row.model,
        app_status: row.app_status,
        dm_mapped_status: dmMappedStatus,
        app_smog: row.app_smog,
        dm_smog: row.dm_smog,
        app_detail: row.app_detail,
        dm_detail: row.dm_detail,
        app_inspected: row.app_inspected,
        dm_inspected: row.dm_inspected,
        diff_fields: diffFields,
        snapped_at: row.snapped_at,
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    mismatches,
    total: mismatches.length,
  });
}
