import { NextResponse } from "next/server";
import db from "@/lib/db";
import { mapDmToAppStatus } from "@/lib/dm-status-map";

export async function GET() {
  // Get latest batch timestamp
  const latest = await db("deskmanager_data")
    .max("imported_at as max")
    .first();
  if (!latest?.max) {
    return NextResponse.json({
      incoming: [], recon: [], parked: [], for_sale: [], holding: [], sold: [],
    });
  }

  // Query latest batch with pics_taken join
  const vehicles = await db("deskmanager_data")
    .leftJoin("vehicle_supplement", "deskmanager_data.stock_number", "vehicle_supplement.stock_number")
    .select(
      "deskmanager_data.*",
      db.raw("coalesce(vehicle_supplement.pics_taken, 0) as pics_taken"),
      db.raw("round(julianday('now') - julianday(deskmanager_data.imported_at)) as dom"),
    )
    .where("deskmanager_data.imported_at", latest.max)
    .orderBy("deskmanager_data.stock_number", "asc");

  const pipeline: Record<string, any[]> = {
    incoming: [],
    recon: [],
    parked: [],
    for_sale: [],
    holding: [],
    sold: [],
  };

  for (const v of vehicles) {
    const status = mapDmToAppStatus(v.dm_status, v.dm_substatus) || "incoming";
    // Map holding to not_for_sale for the grouping
    const key = status === "not_for_sale" ? "holding" : status;
    if (pipeline[key]) {
      pipeline[key].push({
        stock_number: v.stock_number,
        dm_make: v.dm_make,
        dm_model: v.dm_model,
        dm_year: v.dm_year,
        dm_color: v.dm_color,
        dm_vin: v.dm_vin,
        dm_series: v.dm_series,
        dm_mileage: v.dm_mileage,
        dm_total_cost: v.dm_total_cost,
        dm_selling_price: v.dm_selling_price,
        dm_internet_price: v.dm_internet_price,
        dm_smog: v.dm_smog,
        dm_detail: v.dm_detail,
        dm_inspected: v.dm_inspected,
        pics_taken: v.pics_taken,
        dom: v.dom,
        status,
      });
    }
  }

  return NextResponse.json(pipeline);
}