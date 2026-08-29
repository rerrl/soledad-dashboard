import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("deskmanager_raw_data", (table) => {
    table.increments("id");
    table.text("stock_number").notNullable();
    table.text("dm_status");
    table.text("dm_substatus");
    table.integer("dm_smog");
    table.integer("dm_detail");
    table.integer("dm_inspected");
    table.float("dm_total_cost");
    table.float("dm_selling_price");
    table.float("dm_internet_price");
    table.integer("dm_mileage");
    table.text("dm_series");
    table.text("dm_color");
    table.integer("dm_year");
    table.text("dm_make");
    table.text("dm_model");
    table.text("dm_vin");
    table.text("snapped_at").notNullable();
  });

  await knex.schema.alterTable("vehicles", (table) => {
    table.integer("deskmanager_data_id").references("id").inTable("deskmanager_raw_data");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("vehicles", (table) => {
    table.dropColumn("deskmanager_data_id");
  });
  await knex.schema.dropTableIfExists("deskmanager_raw_data");
}