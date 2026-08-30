import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: NextRequest) {
  const body = await req.json();

  if (!body.stock_number || body.value === undefined) {
    return NextResponse.json({ error: "stock_number and value are required" }, { status: 400 });
  }

  const value = body.value ? 1 : 0;

  // Upsert: INSERT OR REPLACE (SQLite-compatible)
  await db.raw(
    `INSERT OR REPLACE INTO vehicle_supplement (stock_number, pics_taken, updated_at)
     VALUES (?, ?, datetime('now'))`,
    [body.stock_number, value],
  );

  return NextResponse.json({ stock_number: body.stock_number, pics_taken: value });
}