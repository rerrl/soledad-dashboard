import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await db("change_log").where("id", numId).update({ viewed_at: now });

  return NextResponse.json({ success: true, viewed_at: now });
}