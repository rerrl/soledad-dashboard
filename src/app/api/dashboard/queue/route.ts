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

  // Stalled in recon — 5+ days since import (proxy for status not changing)
  const stalledRecon = await db("vehicles")
    .select("id", "stock_number", "make", "model", "year", "imported_at")
    .where("status", "recon" as VehicleStatus)
    .whereRaw("julianday('now') - julianday(imported_at) >= 5");

  for (const v of stalledRecon) {
    items.push({
      type: "stalled_in_recon",
      vehicle_id: v.id,
      stock_number: v.stock_number,
      make: v.make,
      model: v.model,
      year: v.year,
      severity: "warning",
      detail: `In recon ${Math.round(
        new Date().getTime() / 86400000 -
          new Date(v.imported_at).getTime() / 86400000
      )} days`,
    });
  }

  // Stalled parked — 14+ days
  const stalledParked = await db("vehicles")
    .select("id", "stock_number", "make", "model", "year", "imported_at")
    .where("status", "parked" as VehicleStatus)
    .whereRaw("julianday('now') - julianday(imported_at) >= 14");

  for (const v of stalledParked) {
    items.push({
      type: "stalled_parked",
      vehicle_id: v.id,
      stock_number: v.stock_number,
      make: v.make,
      model: v.model,
      year: v.year,
      severity: "warning",
      detail: `Parked ${Math.round(
        new Date().getTime() / 86400000 -
          new Date(v.imported_at).getTime() / 86400000
      )} days`,
    });
  }

  // Aged 90+ days
  const aged90 = await db("vehicles")
    .select("id", "stock_number", "make", "model", "year", "imported_at")
    .whereNotIn("status", ["sold" as VehicleStatus, "not_for_sale" as VehicleStatus])
    .whereRaw("julianday('now') - julianday(imported_at) >= 90");

  for (const v of aged90) {
    const days = Math.round(
      new Date().getTime() / 86400000 -
        new Date(v.imported_at).getTime() / 86400000
    );
    items.push({
      type: "aged_90_plus",
      vehicle_id: v.id,
      stock_number: v.stock_number,
      make: v.make,
      model: v.model,
      year: v.year,
      severity: "critical",
      detail: `${days} days on lot — needs attention`,
    });
  }

  // Unposted to FB — null or 30+ days
  const unposted = await db("vehicles")
    .select("id", "stock_number", "make", "model", "year", "last_fb_post")
    .whereNotIn("status", ["sold" as VehicleStatus, "not_for_sale" as VehicleStatus])
    .where((qb) => {
      qb.whereNull("last_fb_post").orWhereRaw(
        "julianday('now') - julianday(last_fb_post) >= 30"
      );
    });

  for (const v of unposted) {
    const detail = v.last_fb_post
      ? `Not posted since ${v.last_fb_post}`
      : "Never posted to Facebook";
    items.push({
      type: "unposted_30_days",
      vehicle_id: v.id,
      stock_number: v.stock_number,
      make: v.make,
      model: v.model,
      year: v.year,
      severity: "warning",
      detail,
    });
  }

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