import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("vehicle_checklist_items");
  await knex.schema.dropTableIfExists("sales");
  await knex.schema.dropTableIfExists("import_log");
  await knex.schema.dropTableIfExists("deskmanager_raw_data");
  await knex.raw("DROP TRIGGER IF EXISTS vehicles_status_check");
  await knex.schema.dropTableIfExists("change_log"); // old change_log (has vehicle_id FK)
  await knex.schema.dropTableIfExists("vehicles");
}

export async function down(knex: Knex): Promise<void> {
  // No going back
}