import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("deskmanager_data", (table) => {
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
    table.text("imported_at").notNullable();
    table.text("dm_inventory_date");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("deskmanager_data");
}