import type { Knex } from "knex";

/**
 * kbb_valuations — append-only KBB valuation history.
 *
 * KBB valuations used to live as three columns on deskmanager_data, which meant
 * only the CURRENT valuation survived an import. This table becomes the single
 * source of truth: every distinct (retail, wholesale, valuation_date) tuple a
 * stock has ever reported is kept, stamped with the import batch that captured
 * it. Year/make/model/mileage are denormalized from the same snapshot row so
 * future aggregates (value by make/year) don't need to reach back into
 * deskmanager_data.
 */

interface DmValuationSnapshot {
  stock_number: string;
  dm_year: number | null;
  dm_make: string | null;
  dm_model: string | null;
  dm_mileage: number | null;
  dm_retail_value: number | null;
  dm_wholesale_value: number | null;
  dm_valuation_date: string | null;
  imported_at: string;
}

interface KbbInsert {
  stock_number: string;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  retail_usd: number | null;
  wholesale_usd: number | null;
  valuation_date: string | null;
  captured_at: string;
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("kbb_valuations", (table) => {
    table.increments("id");
    table.text("stock_number").notNullable();
    // Denormalized grouping dimensions (populated from the snapshot row).
    table.integer("year");
    table.text("make");
    table.text("model");
    table.float("mileage");
    table.float("retail_usd");
    table.float("wholesale_usd");
    // KBB "as of" date from the CSV, ISO YYYY-MM-DD.
    table.text("valuation_date");
    // Import batch timestamp that captured this valuation.
    table.text("captured_at").notNullable();

    table.index(["stock_number"]);
    table.index(["make", "year"]);
  });

  // ── Backfill history from deskmanager_data ─────────────────────────────
  // One row per DISTINCT valuation per stock: walk each stock's snapshots in
  // import order and record a new point only when the valuation tuple changed
  // from that stock's previously recorded point. Rows with no valuation at all
  // (retail and wholesale both null) are never captured.
  const history: DmValuationSnapshot[] = await knex("deskmanager_data")
    .select(
      "stock_number",
      "dm_year",
      "dm_make",
      "dm_model",
      "dm_mileage",
      "dm_retail_value",
      "dm_wholesale_value",
      "dm_valuation_date",
      "imported_at",
    )
    // id is the within-batch tiebreaker so same-timestamp snapshots replay in
    // insertion order.
    .orderBy([
      { column: "imported_at", order: "asc" },
      { column: "id", order: "asc" },
    ]);

  const latestByStock = new Map<
    string,
    { retail: number | null; wholesale: number | null; valuation_date: string | null }
  >();
  const inserts: KbbInsert[] = [];

  for (const row of history) {
    const retail = row.dm_retail_value ?? null;
    const wholesale = row.dm_wholesale_value ?? null;
    const valuationDate = row.dm_valuation_date ?? null;

    if (retail === null && wholesale === null) continue;

    const prev = latestByStock.get(row.stock_number);
    if (
      prev &&
      prev.retail === retail &&
      prev.wholesale === wholesale &&
      prev.valuation_date === valuationDate
    ) {
      continue; // unchanged valuation — not a new point
    }

    latestByStock.set(row.stock_number, {
      retail,
      wholesale,
      valuation_date: valuationDate,
    });
    inserts.push({
      stock_number: row.stock_number,
      year: row.dm_year ?? null,
      make: row.dm_make ?? null,
      model: row.dm_model ?? null,
      mileage: row.dm_mileage ?? null,
      retail_usd: retail,
      wholesale_usd: wholesale,
      valuation_date: valuationDate,
      captured_at: row.imported_at,
    });
  }

  const CHUNK_SIZE = 50;
  for (let i = 0; i < inserts.length; i += CHUNK_SIZE) {
    await knex("kbb_valuations").insert(inserts.slice(i, i + CHUNK_SIZE));
  }

  // ── Retire the deskmanager_data valuation columns ──────────────────────
  // History is safely in kbb_valuations now, so the three flat columns go away.
  await knex.schema.alterTable("deskmanager_data", (table) => {
    table.dropColumn("dm_retail_value");
    table.dropColumn("dm_wholesale_value");
    table.dropColumn("dm_valuation_date");
  });
}

export async function down(knex: Knex): Promise<void> {
  // NOTE: down is lossy for valuations. The kbb_valuations history is dropped
  // rather than folded back into the dm_* columns, so deskmanager_data's
  // valuations come back empty (they'd be repopulated by the next import).
  // Acceptable: the history only ever existed in this table.
  await knex.schema.alterTable("deskmanager_data", (table) => {
    table.float("dm_wholesale_value");
    table.float("dm_retail_value");
    table.text("dm_valuation_date");
  });

  await knex.schema.dropTableIfExists("kbb_valuations");
}
