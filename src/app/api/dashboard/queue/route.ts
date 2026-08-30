import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const latest = await db("deskmanager_data")
    .max("imported_at as max")
    .first();

  type QueueItem = {
    type: string;
    stock_number: string;
    make: string;
    model: string;
    year: number;
    severity: "warning" | "critical";
    detail: string;
  };

  const items: QueueItem[] = [];

  if (!latest?.max) {
    return NextResponse.json({ items });
  }

  // Open tasks — checklist_items with done=0, joined to latest batch for vehicle info
  const openTasks = await db("checklist_items as ci")
    .join("deskmanager_data as dd", "ci.stock_number", "dd.stock_number")
    .select(
      "ci.stock_number",
      "dd.dm_make",
      "dd.dm_model",
      "dd.dm_year",
      db.raw("count(ci.id) as open_count"),
    )
    .where("ci.done", 0)
    .andWhere("dd.imported_at", latest.max)
    .groupBy("ci.stock_number");

  for (const t of openTasks.reverse()) {
    items.push({
      type: "open_tasks",
      stock_number: t.stock_number,
      make: t.dm_make ?? "",
      model: t.dm_model ?? "",
      year: t.dm_year ?? 0,
      severity: "warning",
      detail: `${t.open_count} open task${t.open_count !== 1 ? "s" : ""}`,
    });
  }

  return NextResponse.json({ items });
}