import { NextResponse } from "next/server";
import db from "@/lib/db";
import type { VehicleStatus } from "@/lib/types";

export async function GET() {
  type QueueItem = {
    type: string;
    vehicle_id: number;
    stock_number: string | null;
    make: string;
    model: string;
    year: number;
    severity: "warning" | "critical";
    detail: string;
  };

  const items: QueueItem[] = [];

  // Open tasks — vehicles with undone checklist items
  const openTasks = await db("vehicle_checklist_items as ci")
    .join("vehicles as v", "ci.vehicle_id", "v.id")
    .select(
      "v.id as vehicle_id",
      "v.stock_number",
      "v.make",
      "v.model",
      "v.year",
      db.raw("count(ci.id) as open_count")
    )
    .where("ci.done", 0)
    .groupBy("ci.vehicle_id");

  for (const v of openTasks) {
    items.push({
      type: "open_tasks",
      vehicle_id: v.vehicle_id,
      stock_number: v.stock_number,
      make: v.make,
      model: v.model,
      year: v.year,
      severity: "warning",
      detail: `${v.open_count} open task${v.open_count !== 1 ? "s" : ""}`,
    });
  }

  return NextResponse.json({ items });
}