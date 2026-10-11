import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// Marks a vehicle as posted to social channels by stamping
// vehicle_supplement.last_posted_at with the current date/time. Uses an UPSERT
// (matching /api/supplement) so it works whether or not a supplement row exists
// yet, and so posting preserves the other supplement columns.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  if (!body.stock_number) {
    return NextResponse.json(
      { error: "stock_number is required" },
      { status: 400 },
    );
  }

  const lastPostedAt = new Date().toISOString();

  await db.raw(
    `INSERT INTO vehicle_supplement (stock_number, last_posted_at, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(stock_number) DO UPDATE SET
       last_posted_at = excluded.last_posted_at,
       updated_at = datetime('now')`,
    [body.stock_number, lastPostedAt],
  );

  return NextResponse.json({
    stock_number: body.stock_number,
    last_posted_at: lastPostedAt,
  });
}
