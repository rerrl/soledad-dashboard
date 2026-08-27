import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("checklist_templates", (table) => {
    table.increments("id");
    table.text("label").notNullable();
    table.integer("sort_order").notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("checklist_templates");
}