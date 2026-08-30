import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("checklist_items", (table) => {
    table.increments("id");
    table.text("stock_number").notNullable();
    table.text("label").notNullable();
    table.integer("done").notNullable().defaultTo(0);
    table.text("done_at");
    table.integer("sort_order").notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("checklist_items");
}