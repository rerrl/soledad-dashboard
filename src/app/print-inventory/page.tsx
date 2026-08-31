import db from "@/lib/db";
import { mapDmToAppStatus } from "@/lib/dm-status-map";
import PrintTrigger from "./PrintTrigger";
import InventoryTable, { type Vehicle } from "./InventoryTable";

const SECTION_ORDER = ["incoming", "recon", "parked", "for_sale"] as const;

export default async function PrintInventoryPage() {
  const latest = await db("deskmanager_data").max("imported_at as max").first();
  if (!latest?.max) {
    return <p>No inventory data. Import a CSV first.</p>;
  }

  const raw = await db("deskmanager_data")
    .leftJoin("vehicle_supplement", "deskmanager_data.stock_number", "vehicle_supplement.stock_number")
    .select(
      "deskmanager_data.stock_number",
      "deskmanager_data.dm_vin",
      "deskmanager_data.dm_make",
      "deskmanager_data.dm_model",
      "deskmanager_data.dm_year",
      "deskmanager_data.dm_series",
      "deskmanager_data.dm_color",
      "deskmanager_data.dm_mileage",
      "deskmanager_data.dm_total_cost",
      "deskmanager_data.dm_selling_price",
      "deskmanager_data.dm_internet_price",
      "deskmanager_data.dm_smog",
      "deskmanager_data.dm_detail",
      "deskmanager_data.dm_inspected",
      "deskmanager_data.dm_status",
      "deskmanager_data.dm_substatus",
      "deskmanager_data.dm_inventory_date",
      db.raw("coalesce(vehicle_supplement.pics_taken, 0) as pics_taken"),
      db.raw("round(julianday('now') - julianday(deskmanager_data.dm_inventory_date)) as dom"),
    )
    .where("deskmanager_data.imported_at", latest.max)
    .orderBy("deskmanager_data.stock_number", "asc");

  const vehicles: Vehicle[] = raw
    .map((r: any) => {
      const status = mapDmToAppStatus(r.dm_status, r.dm_substatus) || "incoming";
      return {
        stock_number: r.stock_number,
        vin: r.dm_vin,
        make: r.dm_make,
        model: r.dm_model,
        year: r.dm_year,
        series: r.dm_series,
        color: r.dm_color,
        mileage: r.dm_mileage,
        total_cost: r.dm_total_cost,
        selling_price: r.dm_selling_price,
        internet_price: r.dm_internet_price,
        smog_done: r.dm_smog,
        detail_done: r.dm_detail,
        inspected_done: r.dm_inspected,
        pics_taken: r.pics_taken,
        status,
        inventory_date: r.dm_inventory_date,
        dom: r.dom,
      };
    })
    .filter((v: Vehicle) => v.status !== "sold" && v.status !== "not_for_sale");

  const grouped: Record<string, Vehicle[]> = {};
  for (const s of SECTION_ORDER) grouped[s] = [];
  for (const v of vehicles) {
    const s = (v.status || "").toLowerCase();
    if (grouped[s]) grouped[s].push(v);
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const printedStr = now.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      <style>{`
          @page { size: landscape; margin: 0.3in; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: #fff; color: #000;
            font-family: 'Courier New', 'SF Mono', 'Consolas', monospace;
            font-size: 7pt; padding: 8px;
          }
          .page-header { text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 8px; }
          .mode-toggle { text-align: center; margin-bottom: 8px; font-size: 10pt; }
          .section-label {
            font-size: 9pt; font-weight: bold; padding: 4px 4px 2px 4px;
            border-bottom: 1px solid #ccc; background: #fff;
          }
          .section-row td { border-bottom: none; padding-bottom: 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
          th {
            font-size: 8pt; font-weight: bold; text-align: left;
            padding: 1px 4px; border-bottom: 1px solid #999; white-space: nowrap;
          }
          td { padding: 1px 4px; border-bottom: 1px solid #ddd; white-space: nowrap; font-size: 7pt; }
          .col-stock { width: 8ch; text-align: left; }
          .col-vehicle { width: 30ch; text-align: left; max-width: 30ch; overflow: hidden; text-overflow: ellipsis; }
          .col-color { width: 6ch; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .col-miles { width: 7ch; text-align: right; }
          .col-sdi { width: 9ch; text-align: center; }
          .col-vin { width: 14ch; text-align: left; }
          .col-indate { width: 16ch; text-align: right; }
          .col-cost { width: 8ch; text-align: right; }
          .col-price { width: 8ch; text-align: right; }
          .col-net { width: 8ch; text-align: right; }
          .col-margin { width: 8ch; text-align: right; }
          .col-notes { width: 40ch; text-align: left; }
          tbody tr:not(.section-row):nth-child(even) { background-color: #f4f4f4; }
          .footer { text-align: right; font-size: 6pt; color: #666; margin-top: 4px; }
        `}</style>
      <div className="page-header">
        Lot Inventory — Soledad Auto Sales — {dateStr}
      </div>
      <InventoryTable grouped={grouped} />
      <div className="footer">Printed {printedStr}</div>
      {/* <PrintTrigger /> */}
    </>
  );
}
