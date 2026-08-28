import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  // Get all change_log entries with vehicle info, ordered by imported_at desc, id asc within batch
  const entries = await db("change_log")
    .join("vehicles", "change_log.vehicle_id", "vehicles.id")
    .select(
      "change_log.id",
      "change_log.vehicle_id",
      "change_log.stock_number",
      "change_log.field_name",
      "change_log.old_value",
      "change_log.new_value",
      "change_log.change_type",
      "change_log.viewed_at",
      "change_log.source",
      "change_log.imported_at",
      "change_log.created_at",
      "vehicles.make",
      "vehicles.model",
      "vehicles.year",
      "vehicles.vin"
    )
    .orderBy([
      { column: "change_log.imported_at", order: "desc" },
      { column: "change_log.id", order: "asc" },
    ]);

  // Group by imported_at
  const groups: Record<string, any> = {};

  for (const entry of entries) {
    const key = entry.imported_at || "unknown";
    if (!groups[key]) {
      groups[key] = {
        imported_at: entry.imported_at,
        entries: [],
      };
    }

    groups[key].entries.push({
      id: entry.id,
      change_type: entry.change_type,
      vin: entry.vin,
      stock_number: entry.stock_number,
      make: entry.make,
      model: entry.model,
      year: entry.year,
      field_name: entry.field_name,
      old_value: entry.old_value,
      new_value: entry.new_value,
      viewed_at: entry.viewed_at,
      created_at: entry.created_at,
    });
  }

  // Build batches array with batch_viewed flag
  const batches = Object.values(groups).map((group: any) => {
    const entries = group.entries;
    const allViewed = entries.every((e: any) => e.viewed_at != null);
    return {
      imported_at: group.imported_at,
      batch_viewed: allViewed,
      count: entries.length,
      entries,
    };
  });

  return NextResponse.json({ batches });
}