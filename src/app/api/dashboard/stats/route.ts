import { NextResponse } from "next/server";
import db from "@/lib/db";
import { mapDmToAppStatus } from "@/lib/dm-status-map";

export async function GET() {
  const latest = await db("deskmanager_data")
    .max("imported_at as max")
    .first();
  if (!latest?.max) {
    return NextResponse.json({
      total: 0, for_sale: 0, recon: 0, parked: 0, aged_60_plus: 0, avg_dom: 0,
    });
  }

  const vehicles = await db("deskmanager_data")
    .select("dm_status", "dm_substatus", "imported_at")
    .where("imported_at", latest.max);

  let total = 0;
  let forSale = 0;
  let recon = 0;
  let parked = 0;

  for (const v of vehicles) {
    const status = mapDmToAppStatus(v.dm_status, v.dm_substatus);
    total++;
    if (status === "for_sale") forSale++;
    else if (status === "recon") recon++;
    else if (status === "parked") parked++;
  }

  // avg DOM from dm_inventory_date across all latest-batch vehicles
  const domInfo = await db("deskmanager_data")
    .avg({ dom: db.raw("round(julianday('now') - julianday(dm_inventory_date))") })
    .where("imported_at", latest.max)
    .first();

  const dom = Math.round(Number(domInfo?.dom ?? 0));

  // Aged 60+ — vehicles in latest batch with dm_inventory_date >= 60 days ago
  const agedRaw = await db("deskmanager_data")
    .count("stock_number as count")
    .where("imported_at", latest.max)
    .whereRaw("julianday('now') - julianday(dm_inventory_date) >= 60")
    .first();

  const aged60Plus = Number(agedRaw?.count ?? 0);

  return NextResponse.json({
    total,
    for_sale: forSale,
    recon,
    parked,
    aged_60_plus: aged60Plus,
    avg_dom: Math.round(dom),
  });
}