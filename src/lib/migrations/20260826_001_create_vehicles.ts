import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("vehicles", (table) => {
    table.increments("id");
    table.text("vin").notNullable();
    table.text("stock_number");
    table.text("make").notNullable();
    table.text("model").notNullable();
    table.integer("year").notNullable();
    table.text("color");
    table.integer("mileage");
    table.text("series");
    table.float("total_cost");
    table.float("selling_price");
    table.float("internet_price");
    table.text("status").notNullable().defaultTo("incoming");
    table.integer("smog_done").notNullable().defaultTo(0);
    table.integer("detail_done").notNullable().defaultTo(0);
    table.integer("inspected_done").notNullable().defaultTo(0);
    table.integer("pics_taken").notNullable().defaultTo(0);
    table.integer("posted_to_fbm").notNullable().defaultTo(0);
    table
      .text("imported_at")
      .notNullable()
      .defaultTo(knex.raw("(datetime('now'))"));
    table
      .text("updated_at")
      .notNullable()
      .defaultTo(knex.raw("(datetime('now'))"));
  });

  // Add CHECK constraint for status as raw SQL (sqlite3 needs it at table level)
  await knex.raw(
    `CREATE TRIGGER IF NOT EXISTS vehicles_status_check BEFORE INSERT ON vehicles
     BEGIN
       SELECT CASE WHEN NEW.status NOT IN ('incoming','recon','parked','for_sale','not_for_sale','sold')
       THEN RAISE(ABORT,'Invalid status') END;
     END`
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP TRIGGER IF EXISTS vehicles_status_check");
  await knex.schema.dropTableIfExists("vehicles");
}