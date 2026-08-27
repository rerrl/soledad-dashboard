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
      "smog_done",
      "detail_done",
      "inspected_done",
      "status",
      "last_fb_post",
      "reviewed_at",
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

  const pipeline = {
    incoming: vehicles.filter((v) => v.status === "incoming"),
    recon: vehicles.filter((v) => v.status === "recon"),
    parked: vehicles.filter((v) => v.status === "parked"),
    for_sale: vehicles.filter((v) => v.status === "for_sale"),
    hidden: vehicles.filter(
      (v) => v.status === "not_for_sale" || v.status === "sold"
    ),
  };

  return NextResponse.json(pipeline);
}