import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("vehicle_supplement", (table) => {
    table.integer("folder").notNullable().defaultTo(0);
    table.integer("account_center").notNullable().defaultTo(0);
    table.integer("buyers_guide").notNullable().defaultTo(0);
    table.integer("window_sticker").notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("vehicle_supplement", (table) => {
    table.dropColumn("folder");
    table.dropColumn("account_center");
    table.dropColumn("buyers_guide");
    table.dropColumn("window_sticker");
  });
}