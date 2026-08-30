import db from "@/lib/db";
import { mapDmToAppStatus } from "@/lib/dm-status-map";
import PrintTrigger from "./PrintTrigger";

function fmtK(n: number | null): string {
  if (n == null) return "—";
  const k = n / 1000;
  return `$${k.toFixed(1)}K`;
}

function fmtMiles(n: number | null): string {
  if (n == null) return "—";
  return `${(n / 1000).toFixed(1)}K`;
}

function fmtSdiP(smog: number | null, detail: number | null, inspected: number | null, pics: number | null) {
  const dot = (on: boolean) =>
    on
      ? <span style={{color: "#16a34a"}}>●</span>
      : <span style={{color: "#dc2626"}}>○</span>;
  return <>{dot(!!smog)} {dot(!!detail)} {dot(!!inspected)} {dot(!!pics)}</>;
}

function fmtVin(vin: string | null) {
  if (!vin) return "···??????????";
  const display = "···" + vin.slice(-10).toUpperCase();
  const prefix = display.slice(0, -6);
  const boldPart = display.slice(-6);
  return <>{prefix}<strong>{boldPart}</strong></>;
}

function fmtMargin(selling: number | null, cost: number | null) {
  if (selling == null || cost == null) return "—";
  const m = selling - cost;
  if (m < 0) {
    return <span style={{color: "#dc2626"}}>({Math.abs(m / 1000).toFixed(1)}K)</span>;
  }
  return <span style={{color: "#16a34a"}}>${(m / 1000).toFixed(1)}K</span>;
}

interface Vehicle {
  stock_number: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  series: string | null;
  color: string | null;
  mileage: number | null;
  total_cost: number | null;
  selling_price: number | null;
  internet_price: number | null;
  smog_done: number | null;
  detail_done: number | null;
  inspected_done: number | null;
  pics_taken: number | null;
  status: string;
  dom: number | null;
}

const SECTION_ORDER = ["incoming", "recon", "parked", "for_sale"] as const;
const SECTION_LABELS: Record<string, string> = {
  incoming: "INCOMING",
  recon: "IN RECON",
  parked: "PARKED",
  for_sale: "FOR SALE",
};

function vehicleName(v: Vehicle): string {
  const parts = [v.year, v.make, v.model].filter(Boolean);
  if (v.series) parts.push(v.series);
  return parts.join(" ");
}

export default async function PrintInventoryPage() {
  // Get latest batch timestamp
  const latest = await db("deskmanager_data")
    .max("imported_at as max")
    .first();

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
      db.raw("coalesce(vehicle_supplement.pics_taken, 0) as pics_taken"),
      db.raw("round(julianday('now') - julianday(deskmanager_data.dm_inventory_date)) as dom"),
    )
    .where("deskmanager_data.imported_at", latest.max)
    .orderBy("deskmanager_data.stock_number", "asc");

  // Map status and filter out sold/not_for_sale for print
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
        dom: r.dom,
      };
    })
    .filter((v: Vehicle) => v.status !== "sold" && v.status !== "not_for_sale");

  const grouped: Record<string, Vehicle[]> = {};
  for (const v of SECTION_ORDER) {
    grouped[v] = [];
  }
  for (const v of vehicles) {
    const s = (v.status || "").toLowerCase();
    if (grouped[s]) {
      grouped[s].push(v);
    }
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const printedStr = now.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <style>{`
          @page {
            size: landscape;
            margin: 0.3in;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            background: #fff;
            color: #000;
            font-family: 'Courier New', 'SF Mono', 'Consolas', monospace;
            font-size: 7pt;
            padding: 8px;
          }
          .page-header {
            text-align: center;
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .section-label {
            font-size: 9pt;
            font-weight: bold;
            padding: 4px 4px 2px 4px;
            border-bottom: 1px solid #ccc;
            background: #fff;
          }
          .section-row td {
            border-bottom: none;
            padding-bottom: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
          }
          th {
            font-size: 8pt;
            font-weight: bold;
            text-align: left;
            padding: 1px 4px;
            border-bottom: 1px solid #999;
            white-space: nowrap;
          }
          td {
            padding: 1px 4px;
            border-bottom: 1px solid #ddd;
            white-space: nowrap;
            font-size: 7pt;
          }
          .col-stock { width: 8ch; text-align: left; }
          .col-vehicle { width: 30ch; text-align: left; max-width: 30ch; overflow: hidden; text-overflow: ellipsis; }
          .col-color { width: 6ch; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .col-miles { width: 7ch; text-align: right; }
          .col-sdi { width: 9ch; text-align: center; }
          .col-vin { width: 14ch; text-align: left; }
          .col-dom { width: 4ch; text-align: right; }
          .col-cost { width: 8ch; text-align: right; }
          .col-price { width: 8ch; text-align: right; }
          .col-net { width: 8ch; text-align: right; }
          .col-margin { width: 8ch; text-align: right; }
          tbody tr:not(.section-row):nth-child(even) {
            background-color: #f4f4f4;
          }
          .footer {
            text-align: right;
            font-size: 6pt;
            color: #666;
            margin-top: 4px;
          }
        `}</style>
        <div className="page-header">
          Lot Inventory — Soledad Auto Sales — {dateStr}
        </div>
        <table>
          <thead>
            <tr>
              <th className="col-stock">Stock</th>
              <th className="col-vehicle">Vehicle</th>
              <th className="col-color">Color</th>
              <th className="col-miles">Mi</th>
              <th className="col-sdi">S/D/I/P</th>
              <th className="col-vin">VIN</th>
              <th className="col-dom">D</th>
              <th className="col-cost">Cost</th>
              <th className="col-price">Price</th>
              <th className="col-net">Net</th>
              <th className="col-margin">Margin</th>
            </tr>
          </thead>
          <tbody>
            {SECTION_ORDER.flatMap((section) => {
              const items = grouped[section];
              if (items.length === 0) return [];
              return [
                <tr key={`header-${section}`} className="section-row">
                  <td colSpan={11} className="section-label">{SECTION_LABELS[section]} ({items.length})</td>
                </tr>,
                ...items.map((v) => (
                  <tr key={v.stock_number || v.vin || Math.random()}>
                    <td className="col-stock">{v.stock_number || "—"}</td>
                    <td className="col-vehicle">{vehicleName(v)}</td>
                    <td className="col-color">{v.color || "—"}</td>
                    <td className="col-miles">{fmtMiles(v.mileage)}</td>
                    <td className="col-sdi">{fmtSdiP(v.smog_done, v.detail_done, v.inspected_done, v.pics_taken)}</td>
                    <td className="col-vin">{fmtVin(v.vin)}</td>
                    <td className="col-dom">{v.dom != null ? v.dom : "—"}</td>
                    <td className="col-cost">{fmtK(v.total_cost)}</td>
                    <td className="col-price">{fmtK(v.selling_price)}</td>
                    <td className="col-net">{fmtK(v.internet_price)}</td>
                    <td className="col-margin">{fmtMargin(v.selling_price, v.total_cost)}</td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
        <div className="footer">Printed {printedStr}</div>
        <PrintTrigger />
    </>
  );
}