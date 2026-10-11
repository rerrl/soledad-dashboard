import { NextResponse } from "next/server";
import db from "@/lib/db";

interface ChangeLogEntry {
  id: number;
  change_type: string;
  stock_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  viewed_at: string | null;
  created_at: string;
}

interface ChangeLogGroup {
  imported_at: string | null;
  entries: ChangeLogEntry[];
}

export async function GET() {
  const entries = await db("change_log as cl")
    .select(
      "cl.id",
      "cl.stock_number",
      "cl.field_name",
      "cl.old_value",
      "cl.new_value",
      "cl.change_type",
      "cl.viewed_at",
      "cl.source",
      "cl.imported_at",
      "cl.created_at",
      "dd.dm_make",
      "dd.dm_model",
      "dd.dm_year",
    )
    .leftJoin("deskmanager_data as dd", function () {
      this.on("cl.stock_number", "=", "dd.stock_number").andOn(
        "dd.imported_at",
        "=",
        db.raw(
          "(SELECT MAX(dd2.imported_at) FROM deskmanager_data dd2 WHERE dd2.stock_number = cl.stock_number)",
        ),
      );
    })
    .orderBy([
      { column: "cl.imported_at", order: "desc" },
      { column: "cl.id", order: "asc" },
    ]);

  // Group by imported_at
  const groups: Record<string, ChangeLogGroup> = {};

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
      stock_number: entry.stock_number,
      make: entry.dm_make,
      model: entry.dm_model,
      year: entry.dm_year,
      field_name: entry.field_name,
      old_value: entry.old_value,
      new_value: entry.new_value,
      viewed_at: entry.viewed_at,
      created_at: entry.created_at,
    });
  }

  // Build batches array with batch_viewed flag
  const batches = Object.values(groups).map((group: ChangeLogGroup) => {
    const entries = group.entries;
    const allViewed = entries.every((e: ChangeLogEntry) => e.viewed_at != null);
    return {
      imported_at: group.imported_at,
      batch_viewed: allViewed,
      count: entries.length,
      entries,
    };
  });

  return NextResponse.json({ batches });
}