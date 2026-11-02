import { NextResponse } from "next/server";
import db from "@/lib/db";
import type { LibraryResponse, LibraryVehicle } from "@/lib/library";

/**
 * GET /api/vehicles/library
 *
 * The salesmen library feed: every vehicle in the LATEST `deskmanager_data`
 * batch, shaped for the `/dashboard` page.
 *
 * The set and the "days on lot" maths are the pipeline route's
 * (`src/app/api/dashboard/pipeline/route.ts`): latest batch by `imported_at`,
 * with `dom` = `round(julianday('now') - julianday(dm_inventory_date))`. That
 * route drops nothing — every row of the latest batch lands in a lane (statuses
 * it does not recognise fall back to `incoming`) — so this feed is the same
 * vehicle set, including the not-for-sale/holding rows.
 *
 * Deliberately NO auth (the proxy excludes `/api/*`): this runs on the
 * private lot network and the page itself is gated.
 *
 * Response: `{ updatedAt, vehicles: [...] }` where `updatedAt` is the batch's
 * `imported_at` and each vehicle carries the selling price with the internet
 * price as its fallback.
 */
export async function GET() {
  const latest = await db("deskmanager_data").max("imported_at as max").first();
  if (!latest?.max) {
    return NextResponse.json({ updatedAt: null, vehicles: [] } satisfies LibraryResponse);
  }

  const rows = await db("deskmanager_data")
    .select(
      "stock_number",
      "dm_year",
      "dm_make",
      "dm_model",
      "dm_series",
      "dm_vin",
      "dm_mileage",
      "dm_selling_price",
      "dm_internet_price",
    )
    .select(
      db.raw(
        "round(julianday('now') - julianday(deskmanager_data.dm_inventory_date)) as dom",
      ),
    )
    .where("deskmanager_data.imported_at", latest.max)
    .orderBy("deskmanager_data.stock_number", "asc");

  const vehicles: LibraryVehicle[] = rows.map((row) => ({
    stock_number: row.stock_number,
    dm_year: row.dm_year,
    dm_make: row.dm_make,
    dm_model: row.dm_model,
    dm_series: row.dm_series,
    dm_vin: row.dm_vin,
    dm_mileage: row.dm_mileage,
    // Selling price wins; fall back to the internet price when it is null.
    dm_selling_price: row.dm_selling_price ?? row.dm_internet_price ?? null,
    dom: row.dom ?? null,
  }));

  return NextResponse.json({
    updatedAt: latest.max,
    vehicles,
  } satisfies LibraryResponse);
}
