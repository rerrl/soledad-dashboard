import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("vehicle_supplement", (table) => {
    table.text("stock_number").primary();
    table.integer("pics_taken").notNullable().defaultTo(0);
    table
      .text("updated_at")
      .notNullable()
      .defaultTo(knex.raw("(datetime('now'))"));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("vehicle_supplement");
}