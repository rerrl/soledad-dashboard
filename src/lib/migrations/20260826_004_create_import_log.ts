import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("import_log", (table) => {
    table.increments("id");
    table
      .text("imported_at")
      .notNullable()
      .defaultTo(knex.raw("(datetime('now'))"));
    table.integer("vehicles_added").notNullable().defaultTo(0);
    table.integer("vehicles_removed").notNullable().defaultTo(0);
    table.integer("prices_changed").notNullable().defaultTo(0);
    table.text("details");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("import_log");
}