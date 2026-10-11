import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { normalizePostedDate } from "@/lib/posting";

// Sets vehicle_supplement.last_posted_at to a caller-supplied date (past or
// future — future dates schedule a post ahead). Uses an UPSERT (matching
// /api/supplement) so it works whether or not a supplement row exists yet, and
// so posting preserves the other supplement columns.
//
// `last_posted_at` accepts a calendar date (`YYYY-MM-DD`) or an ISO-8601
// timestamp; malformed or empty strings are rejected with 400. The field is
// three-state: omitting it keeps the previous behaviour of stamping "now";
// an explicit `null` CLEARS the value (back to never-posted); any other value
// must be a valid date.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  if (!body.stock_number) {
    return NextResponse.json(
      { error: "stock_number is required" },
      { status: 400 },
    );
  }

  let lastPostedAt: string | null;
  if (body.last_posted_at === undefined) {
    // Omitted → stamp now (legacy behaviour).
    lastPostedAt = new Date().toISOString();
  } else if (body.last_posted_at === null) {
    // Explicit null → clear back to never-posted.
    lastPostedAt = null;
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
