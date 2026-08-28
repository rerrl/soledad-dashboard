import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// GET — list checklist items for a VIN
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vin: string }> }
) {
  const { vin } = await params;

  const vehicle = await db("vehicles").select("id").where("vin", vin).first();
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const items = await db("vehicle_checklist_items")
    .select("id", "label", "done", "done_at", "sort_order")
    .where("vehicle_id", vehicle.id)
    .orderBy("sort_order")
    .orderBy("id");

  return NextResponse.json(items);
}

// POST — add a new checklist item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ vin: string }> }
) {
  const { vin } = await params;
  const body = await request.json();

  if (!body.label || typeof body.label !== "string" || body.label.trim().length === 0) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const vehicle = await db("vehicles").select("id").where("vin", vin).first();
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const maxSort = await db("vehicle_checklist_items")
    .max("sort_order as max")
    .where("vehicle_id", vehicle.id)
    .first();

  const [item] = await db("vehicle_checklist_items")
    .insert({
      vehicle_id: vehicle.id,
      label: body.label.trim(),
      done: 0,
      sort_order: (maxSort?.max ?? 0) + 1,
    })
    .returning("*");

  return NextResponse.json(item, { status: 201 });
}

// PATCH — toggle a checklist item done/undone
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ vin: string }> }
) {
  const { vin } = await params;
  const body = await request.json();

  if (body.id === undefined || body.done === undefined) {
    return NextResponse.json({ error: "id and done are required" }, { status: 400 });
  }

  const vehicle = await db("vehicles").select("id").where("vin", vin).first();
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {
    done: body.done ? 1 : 0,
  };

  if (body.done) {
    updateData.done_at = db.fn.now();
  } else {
    updateData.done_at = null;
  }

  const [item] = await db("vehicle_checklist_items")
    .where({ id: body.id, vehicle_id: vehicle.id })
    .update(updateData)
    .returning("*");

  if (!item) {
    return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

// DELETE — remove a checklist item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ vin: string }> }
) {
  const { vin } = await params;
  const body = await request.json();
  if (body.id === undefined) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const vehicle = await db("vehicles").select("id").where("vin", vin).first();
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const deleted = await db("vehicle_checklist_items")
    .where({ id: body.id, vehicle_id: vehicle.id })
    .del()
    .returning("*");

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}