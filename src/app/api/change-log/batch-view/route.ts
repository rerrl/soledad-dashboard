import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imported_at } = body;

    if (!imported_at) {
      return NextResponse.json({ error: "imported_at is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updated = await db("change_log")
      .where("imported_at", imported_at)
      .whereNull("viewed_at")
      .update({ viewed_at: now });

    return NextResponse.json({ success: true, viewed_at: now, items_marked: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}