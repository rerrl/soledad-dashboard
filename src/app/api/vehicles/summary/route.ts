import { NextResponse } from "next/server";
import db from "@/lib/db";

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
      "last_fb_post",
      "reviewed_at",
      db.raw("round(julianday('now') - julianday(imported_at)) as dom"),
      db.raw("imported_at")
    )
    .whereNot("status", "sold")
    .orderBy("imported_at", "desc");

  return NextResponse.json(vehicles);
}