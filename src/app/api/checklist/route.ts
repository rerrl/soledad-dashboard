import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stockNumber = searchParams.get("stock_number");

  if (!stockNumber) {
    return NextResponse.json({ error: "stock_number is required" }, { status: 400 });
  }

  const items = await db("checklist_items")
    .select("id", "stock_number", "label", "done", "done_at", "sort_order")
    .where("stock_number", stockNumber)
    .orderBy("sort_order")
    .orderBy("id");

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.stock_number || !body.label || typeof body.label !== "string" || body.label.trim().length === 0) {
    return NextResponse.json({ error: "stock_number and label are required" }, { status: 400 });
  }

  const maxSort = await db("checklist_items")
    .max("sort_order as max")
    .where("stock_number", body.stock_number)
    .first();

  const [item] = await db("checklist_items")
    .insert({
      stock_number: body.stock_number,
      label: body.label.trim(),
      done: 0,
      sort_order: (maxSort?.max ?? 0) + 1,
    })
    .returning("*");

  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();

  if (body.id === undefined || body.done === undefined) {
    return NextResponse.json({ error: "id and done are required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    done: body.done ? 1 : 0,
  };

  if (body.done) {
    updateData.done_at = db.fn.now();
  } else {
    updateData.done_at = null;
  }

  const [item] = await db("checklist_items")
    .where("id", body.id)
    .update(updateData)
    .returning("*");

  if (!item) {
    return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();

  if (body.id === undefined) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const deleted = await db("checklist_items")
    .where("id", body.id)
    .del()
    .returning("*");

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}