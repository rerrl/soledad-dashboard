import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { parseCsv } from "@/lib/csv-parser";

interface DiffResult {
  added: string[];
  removed: string[];
  updated: { stock_number: string; fields: { field: string; old_val: string | null; new_val: string | null }[] }[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    if (!body || body.trim().length === 0) {
      return NextResponse.json({ error: "Request body is empty" }, { status: 400 });
    }

    // 1. Parse CSV
    let rows;
    try {
      rows = parseCsv(body);
    } catch (parseErr: any) {
      return NextResponse.json({ error: `Failed to parse CSV: ${parseErr.message}` }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV contains no valid vehicle rows" }, { status: 400 });
    }

    // 2. Generate batch timestamp
    const batchTimestamp = new Date().toISOString();

    // 3. Load previous batch
    const prevImportedAt = await db("deskmanager_data")
      .max("imported_at as max")
      .first();
    const prevRows: Record<string, any> = {};
    if (prevImportedAt?.max) {
      const prev = await db("deskmanager_data")
        .select("*")
        .where("imported_at", prevImportedAt.max);
      for (const r of prev) {
        prevRows[r.stock_number] = r;
      }
    }

    // 4. Build new batch rows
    const newRows: Record<string, any> = {};
    for (const row of rows) {
      newRows[row.stock_number] = row;
    }

    // 5. Compute diff
    const diff: DiffResult = { added: [], removed: [], updated: [] };

    // Added: in new but not in prev
    for (const stock of Object.keys(newRows)) {
      if (!prevRows[stock]) {
        diff.added.push(stock);
      }
    }

    // Removed: in prev but not in new
    for (const stock of Object.keys(prevRows)) {
      if (!newRows[stock]) {
        diff.removed.push(stock);
      }
    }

    // Updated: in both, compare fields
    const CSV_FIELDS: { csv: keyof typeof rows[0]; dm: string }[] = [
      { csv: "year", dm: "dm_year" },
      { csv: "make", dm: "dm_make" },
      { csv: "model", dm: "dm_model" },
      { csv: "vin", dm: "dm_vin" },
      { csv: "color", dm: "dm_color" },
      { csv: "mileage", dm: "dm_mileage" },
      { csv: "series", dm: "dm_series" },
      { csv: "total_cost", dm: "dm_total_cost" },
      { csv: "selling_price", dm: "dm_selling_price" },
      { csv: "internet_price", dm: "dm_internet_price" },
      { csv: "smog_done", dm: "dm_smog" },
      { csv: "detail_done", dm: "dm_detail" },
      { csv: "inspected_done", dm: "dm_inspected" },
      { csv: "status", dm: "dm_status" },
      { csv: "substatus", dm: "dm_substatus" },
    ];

    for (const stock of Object.keys(newRows)) {
      const prev = prevRows[stock];
      if (!prev) continue;

      const fields: { field: string; old_val: string | null; new_val: string | null }[] = [];

      for (const f of CSV_FIELDS) {
        const csvVal = newRows[stock][f.csv];
        const dmVal = prev[f.dm];
        const csvStr = csvVal != null ? String(csvVal) : null;
        const dmStr = dmVal != null ? String(dmVal) : null;

        if (csvStr !== dmStr) {
          fields.push({ field: f.dm, old_val: dmStr, new_val: csvStr });
        }
      }

      if (fields.length > 0) {
        diff.updated.push({ stock_number: stock, fields });
      }
    }

    // 6. Insert ALL parsed rows into deskmanager_data
    const insertBatch = rows.map((row) => ({
      stock_number: row.stock_number,
      dm_status: row.status,
      dm_substatus: row.substatus,
      dm_smog: row.smog_done,
      dm_detail: row.detail_done,
      dm_inspected: row.inspected_done,
      dm_total_cost: row.total_cost,
      dm_selling_price: row.selling_price,
      dm_internet_price: row.internet_price,
      dm_mileage: row.mileage,
      dm_series: row.series,
      dm_color: row.color,
      dm_year: row.year,
      dm_make: row.make,
      dm_model: row.model,
      dm_vin: row.vin,
      imported_at: batchTimestamp,
    }));

    // Insert in chunks to avoid parameter limits
    const CHUNK_SIZE = 50;
    for (let i = 0; i < insertBatch.length; i += CHUNK_SIZE) {
      await db("deskmanager_data").insert(insertBatch.slice(i, i + CHUNK_SIZE));
    }

    // 7. Insert change_log entries
    const changeLogInserts: any[] = [];

    for (const stock of diff.added) {
      const row = newRows[stock];
      changeLogInserts.push({
        stock_number: stock,
        field_name: "vehicle_added",
        old_value: null,
        new_value: `${row.year} ${row.make} ${row.model}`,
        change_type: "added",
        source: "csv_import",
        imported_at: batchTimestamp,
      });
    }

    for (const stock of diff.removed) {
      const prev = prevRows[stock];
      changeLogInserts.push({
        stock_number: stock,
        field_name: "vehicle_removed",
        old_value: `${prev.dm_year} ${prev.dm_make} ${prev.dm_model}`,
        new_value: null,
        change_type: "removed",
        source: "csv_import",
        imported_at: batchTimestamp,
      });
    }

    for (const upd of diff.updated) {
      for (const f of upd.fields) {
        changeLogInserts.push({
          stock_number: upd.stock_number,
          field_name: f.field,
          old_value: f.old_val,
          new_value: f.new_val,
          change_type: "updated",
          source: "csv_import",
          imported_at: batchTimestamp,
        });
      }
    }

    if (changeLogInserts.length > 0) {
      for (let i = 0; i < changeLogInserts.length; i += CHUNK_SIZE) {
        await db("change_log").insert(changeLogInserts.slice(i, i + CHUNK_SIZE));
      }
    }

    // 8. Return summary
    return NextResponse.json({
      summary: {
        added: diff.added.length,
        removed: diff.removed.length,
        updated: diff.updated.length,
      },
    });
  } catch (err: any) {
    console.error("Import error:", err);
    return NextResponse.json({ error: `Import failed: ${err.message}` }, { status: 500 });
  }
}