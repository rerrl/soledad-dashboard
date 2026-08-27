import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  // Get all change_log entries with vehicle info, grouped by stock_number
  // Most recently changed vehicles first
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
      "change_log.created_at",
      "vehicles.make",
      "vehicles.model",
      "vehicles.year",
      "vehicles.vin"
    )
    .orderBy("change_log.created_at", "desc");

  // Group by vehicle (stock_number)
  const groups: Record<string, any> = {};

  for (const entry of entries) {
    const key = entry.stock_number || `vin-${entry.vin}`;
    if (!groups[key]) {
      groups[key] = {
        stock_number: entry.stock_number,
        vin: entry.vin,
        make: entry.make,
        model: entry.model,
        year: entry.year,
        vehicle_id: entry.vehicle_id,
        changes: [],
        has_unviewed: false,
        most_recent_change: entry.created_at,
      };
    }

    groups[key].changes.push({
      id: entry.id,
      field_name: entry.field_name,
      old_value: entry.old_value,
      new_value: entry.new_value,
      change_type: entry.change_type,
      viewed_at: entry.viewed_at,
      source: entry.source,
      created_at: entry.created_at,
    });

    if (!entry.viewed_at) {
      groups[key].has_unviewed = true;
    }

    if (entry.created_at > groups[key].most_recent_change) {
      groups[key].most_recent_change = entry.created_at;
    }
  }

  // Sort groups: most recently changed first
  const grouped = Object.values(groups).sort(
    (a: any, b: any) =>
      new Date(b.most_recent_change).getTime() - new Date(a.most_recent_change).getTime()
  );

  // Sort changes within each group: newest first
  for (const group of grouped) {
    group.changes.sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  return NextResponse.json({ groups: grouped });
}