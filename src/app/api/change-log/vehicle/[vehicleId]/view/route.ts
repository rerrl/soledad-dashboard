import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  const { vehicleId } = await params;
  const numId = parseInt(vehicleId, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid vehicle id" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updated = await db("change_log")
    .where("vehicle_id", numId)
    .whereNull("viewed_at")
    .update({ viewed_at: now });

  return NextResponse.json({ success: true, viewed_at: now, items_marked: updated });
}