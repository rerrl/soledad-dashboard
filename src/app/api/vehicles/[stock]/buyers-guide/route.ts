import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import db from "@/lib/db";
import {
  BUYERS_GUIDE_FILES,
  BuyersGuideVehicle,
  CheckboxMark,
  FRONT_LAYOUT,
  TextField,
  backFields,
  frontFields,
  frontVariant,
} from "@/lib/buyers-guide";

/** Blank Buyers Guide templates live in `public/` next to the other assets. */
const PUBLIC_DIR = path.join(process.cwd(), "public");

async function loadTemplate(file: string): Promise<PDFDocument> {
  const bytes = await fs.readFile(path.join(PUBLIC_DIR, file));
  return PDFDocument.load(bytes);
}

function drawFields(page: PDFPage, font: PDFFont, fields: TextField[]): void {
  for (const field of fields) {
    if (!field.text) continue;
    page.drawText(field.text, {
      x: field.x,
      y: field.y,
      size: field.size,
      font,
      color: rgb(0, 0, 0),
    });
  }
}

/** The X is stroked as two lines so it fills the printed square exactly. */
function drawCheckbox(page: PDFPage, box: CheckboxMark): void {
  const x0 = box.x + box.inset;
  const y0 = box.y + box.inset;
  const x1 = box.x + box.width - box.inset;
  const y1 = box.y + box.height - box.inset;
  const line = { thickness: 1.2, color: rgb(0, 0, 0) };
  page.drawLine({ start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, ...line });
  page.drawLine({ start: { x: x0, y: y1 }, end: { x: x1, y: y0 }, ...line });
}

/**
 * GET /api/vehicles/:stock/buyers-guide
 *
 * Returns the vehicle's FTC Buyers Guide as a 2-page PDF: the front page is the
 * AS IS or IMPLIED WARRANTIES ONLY variant (picked from the odometer reading —
 * see frontVariant) with the vehicle fields filled in, the second page is always
 * the shared back sheet with the dealer's contact details.
 *
 * The vehicle is looked up in the LATEST deskmanager_data batch, the same way
 * the dashboard endpoints resolve "current inventory"; a stock that is not in
 * that batch is a 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stock: string }> },
) {
  const { stock } = await params;

  const latest = await db("deskmanager_data").max("imported_at as max").first();
  if (!latest?.max) {
    return NextResponse.json({ error: "No vehicle data imported" }, { status: 404 });
  }

  const vehicle: BuyersGuideVehicle | undefined = await db("deskmanager_data")
    .select("stock_number", "dm_year", "dm_make", "dm_model", "dm_vin", "dm_mileage")
    .where({ stock_number: stock, imported_at: latest.max })
    .first();

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  const variant = frontVariant(vehicle.dm_mileage);
  const frontFile =
    variant === "asis" ? BUYERS_GUIDE_FILES.frontAsIs : BUYERS_GUIDE_FILES.frontImplied;

  const pdf = await loadTemplate(frontFile);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const frontPage = pdf.getPage(0);
  drawFields(frontPage, font, frontFields(vehicle));
  drawCheckbox(frontPage, FRONT_LAYOUT.checkbox);

  const backTemplate = await loadTemplate(BUYERS_GUIDE_FILES.back);
  const [backPage] = await pdf.copyPages(backTemplate, [0]);
  pdf.addPage(backPage);
  drawFields(backPage, font, backFields());

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="buyers-guide-${stock}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
