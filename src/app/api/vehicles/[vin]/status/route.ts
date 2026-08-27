import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const ALLOWED_STATUSES = [
  "incoming",
  "recon",
  "parked",
  "for_sale",
  "not_for_sale",
  "sold",
];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ vin: string }> }
) {
  const { vin } = await params;
  const body = await request.json();

  if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json(
      {
        error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const updated = await db("vehicles")
    .where("vin", vin)
    .update({ status: body.status, updated_at: db.fn.now() })
    .returning("*");

  if (updated.length === 0) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  return NextResponse.json(updated[0]);
}