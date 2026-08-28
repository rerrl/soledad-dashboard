import { NextResponse } from "next/server";
import db from "@/lib/db";
import type { VehicleStatus } from "@/lib/types";

export async function GET() {
  const [total, forSale, recon, parked] = await Promise.all([
    db("vehicles").count("id as count").whereNot("status", "sold" as VehicleStatus).first(),
    db("vehicles").count("id as count").where("status", "for_sale" as VehicleStatus).first(),
    db("vehicles").count("id as count").where("status", "recon" as VehicleStatus).first(),
    db("vehicles").count("id as count").where("status", "parked" as VehicleStatus).first(),
  ]);

  const aged60Plus = await db("vehicles")
    .count("id as count")
    .whereNotIn("status", ["sold" as VehicleStatus, "not_for_sale" as VehicleStatus])
    .whereRaw("julianday('now') - julianday(imported_at) >= 60")
    .first();

  const avgDom = await db("vehicles")
    .avg({ dom: db.raw("julianday('now') - julianday(imported_at)") })
    .whereNot("status", "sold" as VehicleStatus)
    .first();

  const r = (v: unknown): Record<string, number> =>
    (v as Record<string, number>) ?? {};

  return NextResponse.json({
    total: Number(r(total).count ?? 0),
    for_sale: Number(r(forSale).count ?? 0),
    recon: Number(r(recon).count ?? 0),
    parked: Number(r(parked).count ?? 0),
    aged_60_plus: Number(r(aged60Plus).count ?? 0),
    avg_dom: Math.round(Number(r(avgDom).dom ?? 0)),
  });
}