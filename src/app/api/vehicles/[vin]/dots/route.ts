import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ vin: string }> }
) {
  const { vin } = await params;
  const body = await request.json();

  const updates: Record<string, 0 | 1> = {};
  if (body.smog_done !== undefined) updates.smog_done = body.smog_done ? 1 : 0;
  if (body.detail_done !== undefined) updates.detail_done = body.detail_done ? 1 : 0;
  if (body.inspected_done !== undefined) updates.inspected_done = body.inspected_done ? 1 : 0;
  if (body.pics_taken !== undefined) updates.pics_taken = body.pics_taken ? 1 : 0;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await db("vehicles")
    .where("vin", vin)
    .update({ ...updates, updated_at: db.fn.now() })
    .returning("*");

  if (updated.length === 0) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  return NextResponse.json(updated[0]);
}