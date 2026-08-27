import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("sales", (table) => {
    table.increments("id");
    table.text("vin").notNullable();
    table.text("stock_number");
    table.text("make");
    table.text("model");
    table.integer("year");
    table.float("sold_price");
    table.float("total_cost");
    table.text("sold_date");
    table.text("buyer_name");
    table
      .text("imported_at")
      .notNullable()
      .defaultTo(knex.raw("(datetime('now'))"));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sales");
}