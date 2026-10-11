import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("vehicle_supplement", (table) => {
    // Null = never posted to social channels.
    table.timestamp("last_posted_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("vehicle_supplement", (table) => {
    table.dropColumn("last_posted_at");
  });
}
