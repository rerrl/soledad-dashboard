// seed.ts — Populate the database with realistic sample data for development
// Usage: npx tsx scripts/seed.ts
// Idempotent: clears and re-inserts every time.

import db from "../src/lib/db";

// ── Vehicle Data ─────────────────────────────────────────────────────────

interface SeedVehicle {
  vin: string;
  stock: string;
  make: string;
  model: string;
  year: number;
  color: string;
  mileage: number;
  series: string;
  totalCost: number;
  sellingPrice: number;
  internetPrice: number;
  status: string;
  substatus: string | null;
  smog: number;
  detail: number;
  inspected: number;
  picsTaken: number;
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const BATCH_TIMESTAMP = new Date().toISOString();

const VEHICLES: SeedVehicle[] = [
  // ── TRUCKS ──────────────────────────────────────────────────────
  { vin: "3GCUKSEC9LG123456", stock: "S100", make: "Chevrolet", model: "Silverado 1500", year: 2020, color: "Summit White", mileage: 58420, series: "LT", totalCost: 26500, sellingPrice: 29500, internetPrice: 28346, status: "In Inventory", substatus: "Ready", smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "1FTEW1EP7KFA56789", stock: "S101", make: "Ford", model: "F-150", year: 2019, color: "Oxford White", mileage: 72300, series: "XLT", totalCost: 22300, sellingPrice: 25500, internetPrice: 24886, status: "In Inventory", substatus: "Ready", smog: 1, detail: 0, inspected: 1, picsTaken: 1 },
  { vin: "5TFLA5AB5PX123456", stock: "S102", make: "Toyota", model: "Tundra", year: 2023, color: "Cement Gray", mileage: 18100, series: "SR5", totalCost: 38500, sellingPrice: 42500, internetPrice: 41975, status: "In Inventory", substatus: "Ready", smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "3TMCZ5AN1MM890123", stock: "S103", make: "Toyota", model: "Tacoma", year: 2021, color: "Magnetic Gray", mileage: 41200, series: "TRD Off-Road", totalCost: 29800, sellingPrice: 33500, internetPrice: 32241, status: "In Inventory", substatus: "Ready", smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "1C6RR7KG1JS456789", stock: "S104", make: "Ram", model: "1500", year: 2018, color: "Bright Silver", mileage: 89300, series: "Big Horn", totalCost: 18900, sellingPrice: 21900, internetPrice: 21119, status: "In Inventory", substatus: "Ready", smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "1GC4KVCG7FF234567", stock: "S105", make: "Chevrolet", model: "Silverado 2500 HD", year: 2015, color: "Black", mileage: 121000, series: "LTZ", totalCost: 21500, sellingPrice: 24900, internetPrice: 24150, status: "Recon", substatus: "Hold", smog: 0, detail: 0, inspected: 0, picsTaken: 0 },

  // ── SUVs ────────────────────────────────────────────────────────
  { vin: "1GNSKHKJ6NR345678", stock: "S106", make: "Chevrolet", model: "Tahoe", year: 2022, color: "Satin Steel", mileage: 32400, series: "LT", totalCost: 38900, sellingPrice: 42900, internetPrice: 42172, status: "In Inventory", substatus: "Ready", smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "1FM5K8GCXLGA90123", stock: "S107", make: "Ford", model: "Explorer", year: 2020, color: "Atlas Blue", mileage: 49200, series: "XLT", totalCost: 19200, sellingPrice: 22900, internetPrice: 22258, status: "Recon", substatus: null, smog: 1, detail: 1, inspected: 0, picsTaken: 0 },
  { vin: "5TDGZRBH2PS567890", stock: "S108", make: "Toyota", model: "Highlander", year: 2023, color: "Ruby Red", mileage: 15200, series: "XLE", totalCost: 32600, sellingPrice: 36500, internetPrice: 35246, status: "In Inventory", substatus: "Ready", smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "JTEBU5JR6M5678901", stock: "S109", make: "Toyota", model: "4Runner", year: 2021, color: "Army Green", mileage: 28100, series: "TRD Pro", totalCost: 40300, sellingPrice: 44900, internetPrice: 44296, status: "In Inventory", substatus: "Ready", smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "5FNYF6H58KB123456", stock: "S110", make: "Honda", model: "Pilot", year: 2019, color: "Obsidian Blue", mileage: 67300, series: "EX-L", totalCost: 21700, sellingPrice: 24900, internetPrice: 23708, status: "In Inventory", substatus: "Ready", smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "1GKKVRKD2JJ456789", stock: "S111", make: "Chevrolet", model: "Traverse", year: 2018, color: "Mosaic Black", mileage: 81200, series: "Premier", totalCost: 18700, sellingPrice: 21900, internetPrice: 20642, status: "Recon", substatus: null, smog: 1, detail: 0, inspected: 0, picsTaken: 0 },
  { vin: "JTEBU5JR6E1234567", stock: "S112", make: "Toyota", model: "4Runner", year: 2014, color: "White", mileage: 142000, series: "SR5", totalCost: 14200, sellingPrice: 17500, internetPrice: 16087, status: "Recon", substatus: "Hold", smog: 0, detail: 0, inspected: 0, picsTaken: 0 },
  { vin: "1FM5K8GC4RGA56789", stock: "S113", make: "Ford", model: "Explorer", year: 2024, color: "Carbonized Gray", mileage: 4800, series: "Limited", totalCost: 37800, sellingPrice: 41900, internetPrice: 40842, status: "In Inventory", substatus: null, smog: 0, detail: 0, inspected: 0, picsTaken: 0 },

  // ── SEDANS ──────────────────────────────────────────────────────
  { vin: "4T1G11AK3NU123456", stock: "S114", make: "Toyota", model: "Camry", year: 2022, color: "Celestial Silver", mileage: 24600, series: "SE", totalCost: 19800, sellingPrice: 22900, internetPrice: 22311, status: "In Inventory", substatus: "Ready", smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "1HGCY2F2XPA123456", stock: "S115", make: "Honda", model: "Accord", year: 2023, color: "Still Night Pearl", mileage: 12100, series: "EX", totalCost: 24100, sellingPrice: 27500, internetPrice: 26396, status: "In Inventory", substatus: "Ready", smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "2HGFE2F57LH789012", stock: "S116", make: "Honda", model: "Civic", year: 2020, color: "Aegean Blue", mileage: 39800, series: "EX", totalCost: 16300, sellingPrice: 19500, internetPrice: 18568, status: "Recon", substatus: null, smog: 1, detail: 0, inspected: 1, picsTaken: 0 },
  { vin: "5YFBURHE6KP456789", stock: "S117", make: "Toyota", model: "Corolla", year: 2019, color: "Classic Silver", mileage: 48100, series: "LE", totalCost: 11700, sellingPrice: 14900, internetPrice: 14368, status: "In Inventory", substatus: "Ready", smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "1N4BL4DV8MN345678", stock: "S118", make: "Nissan", model: "Altima", year: 2021, color: "Super Black", mileage: 35600, series: "SR", totalCost: 16100, sellingPrice: 19500, internetPrice: 18970, status: "In Inventory", substatus: "Ready", smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "1G1ZD5ST9GF456789", stock: "S119", make: "Chevrolet", model: "Malibu", year: 2016, color: "Nightfall Gray", mileage: 79800, series: "LT", totalCost: 8400, sellingPrice: 11900, internetPrice: 11305, status: "Recon", substatus: "Hold", smog: 1, detail: 0, inspected: 1, picsTaken: 0 },
  { vin: "19XFL1HS6RE567890", stock: "S120", make: "Honda", model: "Civic", year: 2024, color: "Rallye Red", mileage: 6200, series: "Sport", totalCost: 21500, sellingPrice: 24900, internetPrice: 24177, status: "In Inventory", substatus: null, smog: 0, detail: 0, inspected: 0, picsTaken: 0 },
  { vin: "1FA6P8CF4F1234567", stock: "S121", make: "Ford", model: "Mustang", year: 2015, color: "Ingot Silver", mileage: 68400, series: "GT Premium", totalCost: 18300, sellingPrice: 21500, internetPrice: 20762, status: "Holding", substatus: null, smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
  { vin: "1N4BL4DV1KC345678", stock: "S122", make: "Nissan", model: "Altima", year: 2019, color: "Gun Metallic", mileage: 45500, series: "SR", totalCost: 12800, sellingPrice: 15900, internetPrice: 14883, status: "Holding", substatus: null, smog: 1, detail: 1, inspected: 1, picsTaken: 1 },
];

async function seed() {
  console.log("Seeding database...");

  // Clear existing data — order doesn't matter (no FKs)
  await db("deskmanager_data").del();
  await db("change_log").del();
  await db("checklist_items").del();
  await db("vehicle_supplement").del();
  await db.raw("DELETE FROM sqlite_sequence WHERE name IN ('deskmanager_data', 'change_log', 'checklist_items')");

  // 1. Insert into deskmanager_data (all with same batch timestamp)
  const dmRows = VEHICLES.map((v) => ({
    stock_number: v.stock,
    dm_status: v.status,
    dm_substatus: v.substatus,
    dm_smog: v.smog,
    dm_detail: v.detail,
    dm_inspected: v.inspected,
    dm_total_cost: v.totalCost,
    dm_selling_price: v.sellingPrice,
    dm_internet_price: v.internetPrice,
    dm_mileage: v.mileage,
    dm_series: v.series,
    dm_color: v.color,
    dm_year: v.year,
    dm_make: v.make,
    dm_model: v.model,
    dm_vin: v.vin,
    imported_at: BATCH_TIMESTAMP,
  }));

  const CHUNK_SIZE = 50;
  for (let i = 0; i < dmRows.length; i += CHUNK_SIZE) {
    await db("deskmanager_data").insert(dmRows.slice(i, i + CHUNK_SIZE));
  }
  console.log(`  ✓ ${VEHICLES.length} deskmanager_data rows inserted`);

  // 2. Insert into vehicle_supplement (pics_taken for vehicles that have them)
  const suppRows = VEHICLES
    .filter((v) => v.picsTaken === 1)
    .map((v) => ({
      stock_number: v.stock,
      pics_taken: 1,
      updated_at: BATCH_TIMESTAMP,
    }));

  if (suppRows.length > 0) {
    for (let i = 0; i < suppRows.length; i += CHUNK_SIZE) {
      await db("vehicle_supplement").insert(suppRows.slice(i, i + CHUNK_SIZE));
    }
    console.log(`  ✓ ${suppRows.length} vehicle_supplement rows inserted`);
  }

  // 3. Insert checklist items for non-sold vehicles
  let totalItems = 0;

  const CHECKLIST_TEMPLATES = [
    { label: "Post to FB Marketplace", sort_order: 1 },
  ];

  for (const v of VEHICLES) {
    // Skip vehicles that are essentially "sold" (Holding status we keep, but no need for FB posting on parked)
    for (const t of CHECKLIST_TEMPLATES) {
      let done = 0;
      let doneAt: string | null = null;

      if (t.label === "Post to FB Marketplace" && v.picsTaken) {
        done = 1;
        doneAt = BATCH_TIMESTAMP;
      } else if (t.label === "Post to FB Marketplace" && v.status === "In Inventory" && v.substatus === "Ready") {
        done = 1;
        doneAt = BATCH_TIMESTAMP;
      }

      await db("checklist_items").insert({
        stock_number: v.stock,
        label: t.label,
        done,
        done_at: doneAt,
        sort_order: t.sort_order,
      });
      totalItems++;
    }
  }
  console.log(`  ✓ ${totalItems} checklist items inserted`);

  // 4. Seed change_log entries
  const now = new Date();
  const hoursAgo = (h: number) => {
    const d = new Date(now.getTime() - h * 3600000);
    return d.toISOString();
  };

  let changeCount = 0;

  // Batch 1 — most recent (3 hours ago), ALL UNVIEWED
  const batch1 = hoursAgo(3);
  await db("change_log").insert({
    stock_number: VEHICLES[0].stock,
    field_name: "vehicle_added", old_value: null, new_value: `${VEHICLES[0].year} ${VEHICLES[0].make} ${VEHICLES[0].model}`,
    change_type: "added", source: "csv_import", imported_at: batch1,
  });
  changeCount++;
  await db("change_log").insert({
    stock_number: VEHICLES[1].stock,
    field_name: "vehicle_added", old_value: null, new_value: `${VEHICLES[1].year} ${VEHICLES[1].make} ${VEHICLES[1].model}`,
    change_type: "added", source: "csv_import", imported_at: batch1,
  });
  changeCount++;
  await db("change_log").insert({
    stock_number: VEHICLES[2].stock,
    field_name: "dm_selling_price", old_value: "43500", new_value: "42500",
    change_type: "updated", source: "csv_import", imported_at: batch1,
  });
  changeCount++;

  // Batch 2 — middle (24 hours ago), MIXED VIEWED/UNVIEWED
  const batch2 = hoursAgo(24);
  await db("change_log").insert({
    stock_number: VEHICLES[3].stock,
    field_name: "vehicle_added", old_value: null, new_value: `${VEHICLES[3].year} ${VEHICLES[3].make} ${VEHICLES[3].model}`,
    change_type: "added", source: "csv_import", imported_at: batch2,
  });
  changeCount++;
  await db("change_log").insert({
    stock_number: VEHICLES[4].stock,
    field_name: "dm_mileage", old_value: "89500", new_value: "89300",
    change_type: "updated", source: "csv_import", imported_at: batch2,
    viewed_at: hoursAgo(12),
  });
  changeCount++;

  // Batch 3 — oldest (72 hours ago), ALL VIEWED
  const batch3 = hoursAgo(72);
  const allViewedAt = hoursAgo(48);
  await db("change_log").insert({
    stock_number: VEHICLES[6].stock,
    field_name: "vehicle_added", old_value: null, new_value: `${VEHICLES[6].year} ${VEHICLES[6].make} ${VEHICLES[6].model}`,
    change_type: "added", source: "csv_import", imported_at: batch3,
    viewed_at: allViewedAt,
  });
  changeCount++;
  await db("change_log").insert({
    stock_number: VEHICLES[7].stock,
    field_name: "vehicle_added", old_value: null, new_value: `${VEHICLES[7].year} ${VEHICLES[7].make} ${VEHICLES[7].model}`,
    change_type: "added", source: "csv_import", imported_at: batch3,
    viewed_at: allViewedAt,
  });
  changeCount++;
  await db("change_log").insert({
    stock_number: VEHICLES[8].stock,
    field_name: "dm_internet_price", old_value: "45300", new_value: "44296",
    change_type: "updated", source: "csv_import", imported_at: batch3,
    viewed_at: allViewedAt,
  });
  changeCount++;
  await db("change_log").insert({
    stock_number: VEHICLES[9].stock,
    field_name: "dm_total_cost", old_value: "22500", new_value: "21700",
    change_type: "updated", source: "csv_import", imported_at: batch3,
    viewed_at: allViewedAt,
  });
  changeCount++;

  console.log(`  ✓ ${changeCount} change_log entries inserted`);
  console.log("\nSeed complete! Database is populated.");
}

seed()
  .then(() => {
    db.destroy();
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    db.destroy();
    process.exit(1);
  });