import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("change_log", (table) => {
    table.increments("id");
    table.text("stock_number").notNullable();
    table.text("field_name").notNullable();
    table.text("old_value");
    table.text("new_value");
    table.text("change_type").notNullable().defaultTo("updated");
    table.text("viewed_at");
    table.text("source").notNullable().defaultTo("csv_import");
    table.text("imported_at").notNullable();
    table
      .text("created_at")
      .notNullable()
      .defaultTo(knex.raw("(datetime('now'))"));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("change_log");
}