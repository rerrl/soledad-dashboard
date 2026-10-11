import { NextResponse } from "next/server";
import db from "@/lib/db";
import { mapDmToAppStatus } from "@/lib/dm-status-map";

type PipelineVehicle = {
  stock_number: string;
  last_posted_at: string | null;
  [key: string]: unknown;
};

export async function GET() {
  // Get latest batch timestamp
  const latest = await db("deskmanager_data")
    .max("imported_at as max")
    .first();
  if (!latest?.max) {
    return NextResponse.json({
      incoming: [], recon: [], parked: [], for_sale: [], holding: [],
      needs_posting: [],
    });
  }

  // Query latest batch with pics_taken join
  const vehicles = await db("deskmanager_data")
    .leftJoin("vehicle_supplement", "deskmanager_data.stock_number", "vehicle_supplement.stock_number")
    .select(
      "deskmanager_data.*",
      db.raw("coalesce(vehicle_supplement.pics_taken, 0) as pics_taken"),
      db.raw("coalesce(vehicle_supplement.folder, 0) as folder"),
      db.raw("coalesce(vehicle_supplement.account_center, 0) as account_center"),
      db.raw("coalesce(vehicle_supplement.buyers_guide, 0) as buyers_guide"),
      db.raw("coalesce(vehicle_supplement.window_sticker, 0) as window_sticker"),
      db.raw("vehicle_supplement.last_posted_at as last_posted_at"),
      db.raw("round(julianday('now') - julianday(deskmanager_data.dm_inventory_date)) as dom"),
    )
    .where("deskmanager_data.imported_at", latest.max)
    .orderBy("deskmanager_data.stock_number", "asc");

  const pipeline: Record<string, PipelineVehicle[]> = {
    incoming: [],
    recon: [],
    parked: [],
    for_sale: [],
    holding: [],
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
        folder: v.folder,
        account_center: v.account_center,
        buyers_guide: v.buyers_guide,
        window_sticker: v.window_sticker,
        last_posted_at: v.last_posted_at,
        dom: v.dom,
        status,
      });
    }
  }

  // "Needs Posting" lane: exactly the for_sale vehicles, never-posted (NULL)
  // first, then oldest-posted first. Shares the same objects as `for_sale`.
  pipeline.needs_posting = [...pipeline.for_sale].sort((a, b) => {
    const av = a.last_posted_at;
    const bv = b.last_posted_at;
    if (av == null && bv == null) return 0;
    if (av == null) return -1;
    if (bv == null) return 1;
    return av < bv ? -1 : av > bv ? 1 : 0;
  });

  return NextResponse.json(pipeline);
}