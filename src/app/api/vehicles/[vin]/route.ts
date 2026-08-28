import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ vin: string }> }
) {
  const { vin } = await params;

  const vehicle = await db("vehicles").select("id").where("vin", vin).first();
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  // Delete checklist items first, then the vehicle
  await db("vehicle_checklist_items").where("vehicle_id", vehicle.id).del();
  await db("vehicles").where("vin", vin).del();

  return NextResponse.json({ deleted: true });
}