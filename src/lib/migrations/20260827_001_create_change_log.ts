import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("change_log", (table) => {
    table.increments("id");
    table.integer("vehicle_id").notNullable().references("id").inTable("vehicles");
    table.text("stock_number");
    table.text("field_name").notNullable();
    table.text("old_value");
    table.text("new_value");
    table.text("change_type").notNullable().defaultTo("updated"); // added | updated | flagged
    table.text("viewed_at"); // nullable datetime — null means unviewed
    table.text("source").notNullable().defaultTo("csv_import");
    table.text("imported_at"); // shared batch timestamp — groups entries by import
    table
      .text("created_at")
      .notNullable()
      .defaultTo(knex.raw("(datetime('now'))"));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("change_log");
}