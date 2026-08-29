import db from "@/lib/db";
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

function fmtSdi(smog: number | null, detail: number | null, inspected: number | null): string {
  const s = smog ? "●" : "○";
  const d = detail ? "●" : "○";
  const i = inspected ? "●" : "○";
  return `${s}${d}${i}`;
}

function fmtVin(vin: string | null): string {
  if (!vin) return "···????????";
  return "···" + vin.slice(-8).toUpperCase();
}

function fmtMargin(selling: number | null, cost: number | null): string {
  if (selling == null || cost == null) return "—";
  const m = selling - cost;
  if (m < 0) {
    return `($${Math.abs(m / 1000).toFixed(1)}K)`;
  }
  return fmtK(m);
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
  const vehicles = await db("vehicles")
    .select(
      "stock_number",
      "vin",
      "make",
      "model",
      "year",
      "series",
      "color",
      "mileage",
      "total_cost",
      "selling_price",
      "internet_price",
      "smog_done",
      "detail_done",
      "inspected_done",
      "status",
      db.raw("round(julianday('now') - julianday(imported_at)) as dom")
    )
    .whereNotIn("status", ["sold", "not_for_sale"])
    .orderByRaw(
      "CASE status WHEN 'incoming' THEN 1 WHEN 'recon' THEN 2 WHEN 'parked' THEN 3 WHEN 'for_sale' THEN 4 END"
    )
    .orderBy("imported_at", "desc");

  const grouped: Record<string, Vehicle[]> = {};
  for (const v of SECTION_ORDER) {
    grouped[v] = [];
  }
  for (const v of vehicles) {
    const status = (v.status || "").toLowerCase();
    if (grouped[status]) {
      grouped[status].push(v);
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
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Lot Inventory — Soledad Auto Sales</title>
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
          .section-header {
            font-size: 9pt;
            font-weight: bold;
            margin-top: 6px;
            margin-bottom: 2px;
            border-bottom: 1px solid #ccc;
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
          .col-vehicle { width: 28ch; text-align: left; max-width: 28ch; overflow: hidden; text-overflow: ellipsis; }
          .col-color { width: 8ch; text-align: left; }
          .col-miles { width: 7ch; text-align: right; }
          .col-sdi { width: 5ch; text-align: center; }
          .col-vin { width: 11ch; text-align: left; }
          .col-dom { width: 4ch; text-align: right; }
          .col-cost { width: 8ch; text-align: right; }
          .col-price { width: 8ch; text-align: right; }
          .col-net { width: 8ch; text-align: right; }
          .col-margin { width: 8ch; text-align: right; }
          .footer {
            text-align: right;
            font-size: 6pt;
            color: #666;
            margin-top: 4px;
          }
        `}</style>
      </head>
      <body>
        <div className="page-header">
          Lot Inventory — Soledad Auto Sales — {dateStr}
        </div>
        {SECTION_ORDER.map((section) => {
          const items = grouped[section];
          if (items.length === 0) return null;
          return (
            <div key={section}>
              <div className="section-header">
                {SECTION_LABELS[section]} ({items.length})
              </div>
              <table>
                <thead>
                  <tr>
                    <th className="col-stock">Stock</th>
                    <th className="col-vehicle">Vehicle</th>
                    <th className="col-color">Color</th>
                    <th className="col-miles">Mi</th>
                    <th className="col-sdi">S/D/I</th>
                    <th className="col-vin">VIN</th>
                    <th className="col-dom">D</th>
                    <th className="col-cost">Cost</th>
                    <th className="col-price">Price</th>
                    <th className="col-net">Net</th>
                    <th className="col-margin">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((v) => (
                    <tr key={v.stock_number || v.vin || Math.random()}>
                      <td className="col-stock">{v.stock_number || "—"}</td>
                      <td className="col-vehicle" style={{ maxWidth: "28ch", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {vehicleName(v)}
                      </td>
                      <td className="col-color">{v.color || "—"}</td>
                      <td className="col-miles">{fmtMiles(v.mileage)}</td>
                      <td className="col-sdi">{fmtSdi(v.smog_done, v.detail_done, v.inspected_done)}</td>
                      <td className="col-vin">{fmtVin(v.vin)}</td>
                      <td className="col-dom">{v.dom != null ? v.dom : "—"}</td>
                      <td className="col-cost">{fmtK(v.total_cost)}</td>
                      <td className="col-price">{fmtK(v.selling_price)}</td>
                      <td className="col-net">{fmtK(v.internet_price)}</td>
                      <td className="col-margin">{fmtMargin(v.selling_price, v.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        <div className="footer">Printed {printedStr}</div>
        <PrintTrigger />
      </body>
    </html>
  );
}
