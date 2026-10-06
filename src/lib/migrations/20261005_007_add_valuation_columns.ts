import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("deskmanager_data", (table) => {
    table.float("dm_wholesale_value");
    table.float("dm_retail_value");
    table.text("dm_valuation_date");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("deskmanager_data", (table) => {
    table.dropColumn("dm_wholesale_value");
    table.dropColumn("dm_retail_value");
    table.dropColumn("dm_valuation_date");
  });
}
