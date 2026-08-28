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
      "series",
      "mileage",
      "total_cost",
      "selling_price",
      "internet_price",
      "status",
      "smog_done",
      "detail_done",
      "inspected_done",
      "pics_taken",
      db.raw("round(julianday('now') - julianday(imported_at)) as dom"),
      db.raw("imported_at")
    )
    .whereNot("status", "sold" as VehicleStatus)
    .orderBy("imported_at", "desc");

  return NextResponse.json(vehicles);
}