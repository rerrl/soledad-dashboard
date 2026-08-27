// seed.ts — Populate the database with realistic sample data for development
// Usage: npx tsx scripts/seed.ts
// Idempotent: clears and re-inserts every time.

import db from "../src/lib/db";

// ── Checklist Templates ──────────────────────────────────────────────────
const TEMPLATES = [
  { label: "Smog check", sort_order: 1 },
  { label: "Detail interior", sort_order: 2 },
  { label: "Detail exterior", sort_order: 3 },
  { label: "Safety inspection", sort_order: 4 },
  { label: "Photos taken", sort_order: 5 },
  { label: "Posted to FB", sort_order: 6 },
];

// ── Vehicle Data ─────────────────────────────────────────────────────────
// Each vehicle: make, model, year, color, mileage, series, total_cost,
// selling_price, internet_price, status, imported_at (DOM driver),
// smog/detail/inspected (0/1), last_fb_post, reviewed_at

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
  importedAt: string;
  smog: number;
  detail: number;
  inspected: number;
  lastFbPost: string | null;
  reviewedAt: string | null;
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().replace("T", " ").substring(0, 19);
}

const VEHICLES: SeedVehicle[] = [
  // ── TRUCKS ──────────────────────────────────────────────────────
  // 2020 Silverado 1500 LT — for_sale, healthy condition
  {
    vin: "3GCUKSEC9LG123456",
    stock: "S100",
    make: "Chevrolet",
    model: "Silverado 1500",
    year: 2020,
    color: "Summit White",
    mileage: 58420,
    series: "LT",
    totalCost: 26500,
    sellingPrice: 29500,
    internetPrice: 28346,
    status: "for_sale",
    importedAt: daysAgo(12),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(10),
    reviewedAt: daysAgo(8),
  },
  // 2019 Ford F-150 XLT — for_sale, needs detail
  {
    vin: "1FTEW1EP7KFA56789",
    stock: "S101",
    make: "Ford",
    model: "F-150",
    year: 2019,
    color: "Oxford White",
    mileage: 72300,
    series: "XLT",
    totalCost: 22300,
    sellingPrice: 25500,
    internetPrice: 24886,
    status: "for_sale",
    importedAt: daysAgo(20),
    smog: 1,
    detail: 0,
    inspected: 1,
    lastFbPost: daysAgo(18),
    reviewedAt: null,
  },
  // 2023 Toyota Tundra SR5 — for_sale, fresh
  {
    vin: "5TFLA5AB5PX123456",
    stock: "S102",
    make: "Toyota",
    model: "Tundra",
    year: 2023,
    color: "Cement Gray",
    mileage: 18100,
    series: "SR5",
    totalCost: 38500,
    sellingPrice: 42500,
    internetPrice: 41975,
    status: "for_sale",
    importedAt: daysAgo(5),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(3),
    reviewedAt: null,
  },
  // 2021 Toyota Tacoma TRD Off-Road — for_sale
  {
    vin: "3TMCZ5AN1MM890123",
    stock: "S103",
    make: "Toyota",
    model: "Tacoma",
    year: 2021,
    color: "Magnetic Gray",
    mileage: 41200,
    series: "TRD Off-Road",
    totalCost: 29800,
    sellingPrice: 33500,
    internetPrice: 32241,
    status: "for_sale",
    importedAt: daysAgo(15),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(14),
    reviewedAt: daysAgo(10),
  },
  // 2018 Ram 1500 Big Horn — for_sale, stale FB post
  {
    vin: "1C6RR7KG1JS456789",
    stock: "S104",
    make: "Ram",
    model: "1500",
    year: 2018,
    color: "Bright Silver",
    mileage: 89300,
    series: "Big Horn",
    totalCost: 18900,
    sellingPrice: 21900,
    internetPrice: 21119,
    status: "for_sale",
    importedAt: daysAgo(60),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(45),
    reviewedAt: daysAgo(30),
  },
  // 2015 Silverado 2500 HD LTZ — parked, needs work
  {
    vin: "1GC4KVCG7FF234567",
    stock: "S105",
    make: "Chevrolet",
    model: "Silverado 2500 HD",
    year: 2015,
    color: "Black",
    mileage: 121000,
    series: "LTZ",
    totalCost: 21500,
    sellingPrice: 24900,
    internetPrice: 24150,
    status: "parked",
    importedAt: daysAgo(95),
    smog: 0,
    detail: 0,
    inspected: 0,
    lastFbPost: null,
    reviewedAt: null,
  },

  // ── SUVs ────────────────────────────────────────────────────────
  // 2022 Chevrolet Tahoe LT — for_sale
  {
    vin: "1GNSKHKJ6NR345678",
    stock: "S106",
    make: "Chevrolet",
    model: "Tahoe",
    year: 2022,
    color: "Satin Steel",
    mileage: 32400,
    series: "LT",
    totalCost: 38900,
    sellingPrice: 42900,
    internetPrice: 42172,
    status: "for_sale",
    importedAt: daysAgo(8),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(6),
    reviewedAt: daysAgo(5),
  },
  // 2020 Ford Explorer XLT — recon, waiting on safety
  {
    vin: "1FM5K8GCXLGA90123",
    stock: "S107",
    make: "Ford",
    model: "Explorer",
    year: 2020,
    color: "Atlas Blue",
    mileage: 49200,
    series: "XLT",
    totalCost: 19200,
    sellingPrice: 22900,
    internetPrice: 22258,
    status: "recon",
    importedAt: daysAgo(14),
    smog: 1,
    detail: 1,
    inspected: 0,
    lastFbPost: null,
    reviewedAt: null,
  },
  // 2023 Toyota Highlander XLE — for_sale
  {
    vin: "5TDGZRBH2PS567890",
    stock: "S108",
    make: "Toyota",
    model: "Highlander",
    year: 2023,
    color: "Ruby Red",
    mileage: 15200,
    series: "XLE",
    totalCost: 32600,
    sellingPrice: 36500,
    internetPrice: 35246,
    status: "for_sale",
    importedAt: daysAgo(10),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(9),
    reviewedAt: null,
  },
  // 2021 Toyota 4Runner TRD Pro — for_sale, premium
  {
    vin: "JTEBU5JR6M5678901",
    stock: "S109",
    make: "Toyota",
    model: "4Runner",
    year: 2021,
    color: "Army Green",
    mileage: 28100,
    series: "TRD Pro",
    totalCost: 40300,
    sellingPrice: 44900,
    internetPrice: 44296,
    status: "for_sale",
    importedAt: daysAgo(22),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(20),
    reviewedAt: daysAgo(15),
  },
  // 2019 Honda Pilot EX-L — for_sale
  {
    vin: "5FNYF6H58KB123456",
    stock: "S110",
    make: "Honda",
    model: "Pilot",
    year: 2019,
    color: "Obsidian Blue",
    mileage: 67300,
    series: "EX-L",
    totalCost: 21700,
    sellingPrice: 24900,
    internetPrice: 23708,
    status: "for_sale",
    importedAt: daysAgo(30),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(28),
    reviewedAt: null,
  },
  // 2018 Chevrolet Traverse Premier — recon
  {
    vin: "1GKKVRKD2JJ456789",
    stock: "S111",
    make: "Chevrolet",
    model: "Traverse",
    year: 2018,
    color: "Mosaic Black",
    mileage: 81200,
    series: "Premier",
    totalCost: 18700,
    sellingPrice: 21900,
    internetPrice: 20642,
    status: "recon",
    importedAt: daysAgo(18),
    smog: 1,
    detail: 0,
    inspected: 0,
    lastFbPost: null,
    reviewedAt: null,
  },
  // 2014 Toyota 4Runner SR5 — parked, high miles, aged
  {
    vin: "JTEBU5JR6E1234567",
    stock: "S112",
    make: "Toyota",
    model: "4Runner",
    year: 2014,
    color: "White",
    mileage: 142000,
    series: "SR5",
    totalCost: 14200,
    sellingPrice: 17500,
    internetPrice: 16087,
    status: "parked",
    importedAt: daysAgo(120),
    smog: 0,
    detail: 0,
    inspected: 0,
    lastFbPost: null,
    reviewedAt: null,
  },
  // 2024 Ford Explorer Limited — incoming, still arriving
  {
    vin: "1FM5K8GC4RGA56789",
    stock: "S113",
    make: "Ford",
    model: "Explorer",
    year: 2024,
    color: "Carbonized Gray",
    mileage: 4800,
    series: "Limited",
    totalCost: 37800,
    sellingPrice: 41900,
    internetPrice: 40842,
    status: "incoming",
    importedAt: daysAgo(3),
    smog: 0,
    detail: 0,
    inspected: 0,
    lastFbPost: null,
    reviewedAt: null,
  },

  // ── SEDANS ──────────────────────────────────────────────────────
  // 2022 Toyota Camry SE — for_sale
  {
    vin: "4T1G11AK3NU123456",
    stock: "S114",
    make: "Toyota",
    model: "Camry",
    year: 2022,
    color: "Celestial Silver",
    mileage: 24600,
    series: "SE",
    totalCost: 19800,
    sellingPrice: 22900,
    internetPrice: 22311,
    status: "for_sale",
    importedAt: daysAgo(25),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(23),
    reviewedAt: daysAgo(20),
  },
  // 2023 Honda Accord EX — for_sale
  {
    vin: "1HGCY2F2XPA123456",
    stock: "S115",
    make: "Honda",
    model: "Accord",
    year: 2023,
    color: "Still Night Pearl",
    mileage: 12100,
    series: "EX",
    totalCost: 24100,
    sellingPrice: 27500,
    internetPrice: 26396,
    status: "for_sale",
    importedAt: daysAgo(7),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(5),
    reviewedAt: null,
  },
  // 2020 Honda Civic EX — recon
  {
    vin: "2HGFE2F57LH789012",
    stock: "S116",
    make: "Honda",
    model: "Civic",
    year: 2020,
    color: "Aegean Blue",
    mileage: 39800,
    series: "EX",
    totalCost: 16300,
    sellingPrice: 19500,
    internetPrice: 18568,
    status: "recon",
    importedAt: daysAgo(16),
    smog: 1,
    detail: 0,
    inspected: 1,
    lastFbPost: null,
    reviewedAt: null,
  },
  // 2019 Toyota Corolla LE — for_sale, economy
  {
    vin: "5YFBURHE6KP456789",
    stock: "S117",
    make: "Toyota",
    model: "Corolla",
    year: 2019,
    color: "Classic Silver",
    mileage: 48100,
    series: "LE",
    totalCost: 11700,
    sellingPrice: 14900,
    internetPrice: 14368,
    status: "for_sale",
    importedAt: daysAgo(35),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(33),
    reviewedAt: null,
  },
  // 2021 Nissan Altima SR — for_sale
  {
    vin: "1N4BL4DV8MN345678",
    stock: "S118",
    make: "Nissan",
    model: "Altima",
    year: 2021,
    color: "Super Black",
    mileage: 35600,
    series: "SR",
    totalCost: 16100,
    sellingPrice: 19500,
    internetPrice: 18970,
    status: "for_sale",
    importedAt: daysAgo(28),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(25),
    reviewedAt: null,
  },
  // 2016 Chevrolet Malibu LT — parked, aged 90+
  {
    vin: "1G1ZD5ST9GF456789",
    stock: "S119",
    make: "Chevrolet",
    model: "Malibu",
    year: 2016,
    color: "Nightfall Gray",
    mileage: 79800,
    series: "LT",
    totalCost: 8400,
    sellingPrice: 11900,
    internetPrice: 11305,
    status: "parked",
    importedAt: daysAgo(100),
    smog: 1,
    detail: 0,
    inspected: 1,
    lastFbPost: daysAgo(70),
    reviewedAt: null,
  },
  // 2024 Honda Civic Sport — incoming
  {
    vin: "19XFL1HS6RE567890",
    stock: "S120",
    make: "Honda",
    model: "Civic",
    year: 2024,
    color: "Rallye Red",
    mileage: 6200,
    series: "Sport",
    totalCost: 21500,
    sellingPrice: 24900,
    internetPrice: 24177,
    status: "incoming",
    importedAt: daysAgo(2),
    smog: 0,
    detail: 0,
    inspected: 0,
    lastFbPost: null,
    reviewedAt: null,
  },
  // 2015 Ford Mustang GT Premium — not_for_sale, personal/display
  {
    vin: "1FA6P8CF4F1234567",
    stock: "S121",
    make: "Ford",
    model: "Mustang",
    year: 2015,
    color: "Ingot Silver",
    mileage: 68400,
    series: "GT Premium",
    totalCost: 18300,
    sellingPrice: 21500,
    internetPrice: 20762,
    status: "not_for_sale",
    importedAt: daysAgo(50),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(45),
    reviewedAt: daysAgo(40),
  },
  // 2019 Nissan Altima SR — SOLD
  {
    vin: "1N4BL4DV1KC345678",
    stock: "S122",
    make: "Nissan",
    model: "Altima",
    year: 2019,
    color: "Gun Metallic",
    mileage: 45500,
    series: "SR",
    totalCost: 12800,
    sellingPrice: 15900,
    internetPrice: 14883,
    status: "sold",
    importedAt: daysAgo(75),
    smog: 1,
    detail: 1,
    inspected: 1,
    lastFbPost: daysAgo(73),
    reviewedAt: daysAgo(70),
  },
];

// ── Main ──────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Seeding database...");

  // Clear existing data (respect FK order — checklist items first, then vehicles)
  await db("vehicle_checklist_items").del();
  await db("vehicles").del();

  // Reset auto-increment counters
  await db.raw(
    "DELETE FROM sqlite_sequence WHERE name IN ('vehicles', 'vehicle_checklist_items')"
  );

  // Insert vehicles
  const vehicleIds: number[] = [];

  for (const v of VEHICLES) {
    const ids = await db("vehicles").insert({
      vin: v.vin,
      stock_number: v.stock,
      make: v.make,
      model: v.model,
      year: v.year,
      color: v.color,
      mileage: v.mileage,
      series: v.series,
      total_cost: v.totalCost,
      selling_price: v.sellingPrice,
      internet_price: v.internetPrice,
      status: v.status,
      imported_at: v.importedAt,
      smog_done: v.smog,
      detail_done: v.detail,
      inspected_done: v.inspected,
      last_fb_post: v.lastFbPost,
      reviewed_at: v.reviewedAt,
      updated_at: v.importedAt,
    });
    vehicleIds.push(ids[0] as number);
  }
  console.log(`  ✓ ${VEHICLES.length} vehicles inserted`);

  // Create checklist items for non-sold vehicles
  let totalItems = 0;

  for (let i = 0; i < VEHICLES.length; i++) {
    const v = VEHICLES[i];
    if (v.status === "sold") continue;

    const vehicleId = vehicleIds[i];
    if (!vehicleId) continue;

    for (const t of TEMPLATES) {
      let done = 0;
      let doneAt: string | null = null;

      if (t.label === "Smog check" && v.smog) {
        done = 1;
        doneAt = daysAgo(Math.floor(Math.random() * 5 + 2));
      } else if (t.label === "Detail interior" && v.detail) {
        done = 1;
        doneAt = daysAgo(Math.floor(Math.random() * 4 + 1));
      } else if (t.label === "Detail exterior" && v.detail) {
        done = 1;
        doneAt = daysAgo(Math.floor(Math.random() * 4 + 1));
      } else if (t.label === "Safety inspection" && v.inspected) {
        done = 1;
        doneAt = daysAgo(Math.floor(Math.random() * 7 + 3));
      } else if (t.label === "Photos taken" && v.lastFbPost) {
        done = 1;
        doneAt = daysAgo(Math.floor(Math.random() * 3 + 1));
      } else if (t.label === "Posted to FB" && v.lastFbPost) {
        done = 1;
        doneAt = v.lastFbPost;
      } else {
        const rand = Math.random();
        if (rand > 0.6) {
          done = 1;
          doneAt = daysAgo(Math.floor(Math.random() * 10 + 1));
        }
      }

      await db("vehicle_checklist_items").insert({
        vehicle_id: vehicleId,
        label: t.label,
        done: done,
        done_at: doneAt,
        sort_order: t.sort_order,
      });
      totalItems++;
    }
  }
  console.log(`  ✓ ${totalItems} checklist items inserted`);
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