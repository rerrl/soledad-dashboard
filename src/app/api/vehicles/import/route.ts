import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { parseCsv } from "@/lib/csv-parser";
import { computeDiff, applyDiff } from "@/lib/import-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    if (!body || body.trim().length === 0) {
      return NextResponse.json({ error: "Request body is empty" }, { status: 400 });
    }

    // Parse CSV
    let rows;
    try {
      rows = parseCsv(body);
    } catch (parseErr: any) {
      return NextResponse.json(
        { error: `Failed to parse CSV: ${parseErr.message}` },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "CSV contains no valid vehicle rows" },
        { status: 400 }
      );
    }

    // Compute diff
    const diff = await computeDiff(rows);

    // Check if this is an apply request
    const { searchParams } = new URL(req.url);
    const shouldApply = searchParams.get("apply") === "true";

    if (shouldApply) {
      await applyDiff(diff, rows);
      return NextResponse.json({
        applied: true,
        summary: {
          added: diff.added.length,
          updated: diff.updated.length,
          flagged: diff.flagged.length,
        },
        diff,
      });
    }

    // Preview mode — return diff without applying
    return NextResponse.json({
      applied: false,
      summary: {
        added: diff.added.length,
        updated: diff.updated.length,
        flagged: diff.flagged.length,
      },
      diff,
    });
  } catch (err: any) {
    console.error("Import error:", err);
    return NextResponse.json(
      { error: `Import failed: ${err.message}` },
      { status: 500 }
    );
  }
}