import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ vin: string }> }
) {
  const { vin } = await params;

  const updated = await db("vehicles")
    .where("vin", vin)
    .update({
      reviewed_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning("*");

  if (updated.length === 0) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  return NextResponse.json(updated[0]);
}