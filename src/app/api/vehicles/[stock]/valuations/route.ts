import { NextResponse } from "next/server";
import db from "@/lib/db";

type ValuationPoint = {
  valuation_date: string | null;
  captured_at: string;
  retail_usd: number | null;
  wholesale_usd: number | null;
  mileage: number | null;
};

type ValuationRow = ValuationPoint & {
  year: number | null;
  make: string | null;
  model: string | null;
};

/**
 * GET /api/vehicles/:stock/valuations
 *
 * KBB valuation history for one stock, oldest point first — the series behind
 * the valuation trend chart. kbb_valuations is append-only, so every row is one
 * observed valuation; points are only ever written when the
 * (retail, wholesale, valuation_date) tuple changes (see the import route).
 *
 * Ordering follows the KBB "as of" date when the CSV supplied one, falling back
 * to the calendar day the batch was captured, then captured_at, then id so the
 * order stays deterministic inside a single import batch.
 *
 * An unknown stock_number is NOT a 404: vehicles legitimately have no
 * valuations yet, so callers get 200 with an empty points array and render an
 * empty state.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stock: string }> },
) {
  const { stock } = await params;

  const rows: ValuationRow[] = await db("kbb_valuations")
    .select(
      "year",
      "make",
      "model",
      "mileage",
      "retail_usd",
      "wholesale_usd",
      "valuation_date",
      "captured_at",
    )
    .where("stock_number", stock)
    .orderByRaw(
      "coalesce(valuation_date, date(captured_at)) asc, captured_at asc, id asc",
    );

  const points: ValuationPoint[] = rows.map((row) => ({
    valuation_date: row.valuation_date ?? null,
    captured_at: row.captured_at,
    retail_usd: row.retail_usd ?? null,
    wholesale_usd: row.wholesale_usd ?? null,
    mileage: row.mileage ?? null,
  }));

  // Year/make/model are denormalized onto each point; the newest point is the
  // last one in chronological order, which is what a chart header describes.
  // Null (not omitted) when the stock has no history, so the shape is stable.
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;

  return NextResponse.json({
    stock_number: stock,
    year: latest?.year ?? null,
    make: latest?.make ?? null,
    model: latest?.model ?? null,
    points,
  });
}
