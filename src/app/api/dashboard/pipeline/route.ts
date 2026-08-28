import { NextResponse } from "next/server";
import db from "@/lib/db";
import type { VehicleStatus } from "@/lib/types";

export async function GET() {
  const vehicles = await db("vehicles")
    .select(
      "id",
      "vin",
      "stock_number",
      "make",
      "model",
      "year",
      "color",
      "smog_done",
      "detail_done",
      "inspected_done",
      "pics_taken",
      "status",
      db.raw("round(julianday('now') - julianday(imported_at)) as dom"),
      db.raw("imported_at")
    )
    .orderByRaw("CASE status " +
      "WHEN 'incoming' THEN 1 " +
      "WHEN 'recon' THEN 2 " +
      "WHEN 'parked' THEN 3 " +
      "WHEN 'for_sale' THEN 4 " +
      "WHEN 'not_for_sale' THEN 5 " +
      "WHEN 'sold' THEN 6 END")
    .orderBy("imported_at", "desc");

  const pipeline: Record<string, VehicleSummary[]> = {
    incoming: vehicles.filter((v) => v.status === ("incoming" as VehicleStatus)),
    recon: vehicles.filter((v) => v.status === ("recon" as VehicleStatus)),
    parked: vehicles.filter((v) => v.status === ("parked" as VehicleStatus)),
    for_sale: vehicles.filter((v) => v.status === ("for_sale" as VehicleStatus)),
    hidden: vehicles.filter(
      (v) => v.status === ("not_for_sale" as VehicleStatus)
    ),
    sold: vehicles.filter(
      (v) => v.status === ("sold" as VehicleStatus)
    ),
  };

  return NextResponse.json(pipeline);
}

type VehicleSummary = {
  id: number;
  vin: string;
  stock_number: string | null;
  make: string;
  model: string;
  year: number;
  color: string | null;
  smog_done: number;
  detail_done: number;
  inspected_done: number;
  pics_taken: number;
  status: VehicleStatus;
  dom: number;
};