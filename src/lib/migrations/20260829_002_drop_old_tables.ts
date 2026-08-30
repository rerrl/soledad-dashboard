import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Disable FK enforcement temporarily to drop tables with FKs
  await knex.raw("PRAGMA foreign_keys = OFF");

  await knex.schema.dropTableIfExists("vehicle_checklist_items");
  await knex.schema.dropTableIfExists("sales");
  await knex.schema.dropTableIfExists("import_log");
  await knex.schema.dropTableIfExists("deskmanager_raw_data");
  await knex.raw("DROP TRIGGER IF EXISTS vehicles_status_check");
  await knex.schema.dropTableIfExists("change_log"); // old change_log (has vehicle_id FK)
  await knex.schema.dropTableIfExists("vehicles");

  await knex.raw("PRAGMA foreign_keys = ON");
}

export async function down(knex: Knex): Promise<void> {
  // No going back
}