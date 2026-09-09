import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { SUPPLEMENT_COLUMNS } from "@/lib/supplement";

// Generic toggle for the vehicle supplement fields (pics_taken, folder,
// account_center, buyers_guide, window_sticker). Uses an UPSERT so toggling one
// field preserves the values of the others (INSERT OR REPLACE would wipe them).
export async function PUT(req: NextRequest) {
  const body = await req.json();

  if (!body.stock_number) {
    return NextResponse.json(
      { error: "stock_number is required" },
      { status: 400 },
    );
  }

  const field = body.field as string;
  if (!SUPPLEMENT_COLUMNS.includes(field)) {
    return NextResponse.json(
      { error: `field must be one of: ${SUPPLEMENT_COLUMNS.join(", ")}` },
      { status: 400 },
    );
  }

  if (body.value === undefined) {
    return NextResponse.json(
      { error: "value is required" },
      { status: 400 },
    );
  }

  const value = body.value ? 1 : 0;

  await db.raw(
    `INSERT INTO vehicle_supplement (stock_number, ${field}, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(stock_number) DO UPDATE SET
       ${field} = excluded.${field},
       updated_at = datetime('now')`,
    [body.stock_number, value],
  );

  return NextResponse.json({ stock_number: body.stock_number, field, value });
}