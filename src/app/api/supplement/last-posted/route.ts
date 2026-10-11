import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { normalizePostedDate } from "@/lib/posting";

// Sets vehicle_supplement.last_posted_at to a caller-supplied date (past or
// future — future dates schedule a post ahead). Uses an UPSERT (matching
// /api/supplement) so it works whether or not a supplement row exists yet, and
// so posting preserves the other supplement columns.
//
// `last_posted_at` accepts a calendar date (`YYYY-MM-DD`) or an ISO-8601
// timestamp; malformed values are rejected with 400. Omitting the field keeps
// the previous behaviour of stamping "now".
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  if (!body.stock_number) {
    return NextResponse.json(
      { error: "stock_number is required" },
      { status: 400 },
    );
  }

  let lastPostedAt: string;
  if (body.last_posted_at === undefined || body.last_posted_at === null) {
    lastPostedAt = new Date().toISOString();
  } else {
    const parsed = normalizePostedDate(body.last_posted_at);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    lastPostedAt = parsed.iso;
  }

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
