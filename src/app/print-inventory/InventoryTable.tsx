"use client";

import { useState } from "react";

function fmtK(n: number | null): string {
  if (n == null) return "—";
  return `$${(n / 1000).toFixed(1)}K`;
}

function fmtMiles(n: number | null): string {
  if (n == null) return "—";
  return `${(n / 1000).toFixed(1)}K`;
}

function fmtSdiP(smog: number | null, detail: number | null, inspected: number | null, pics: number | null) {
  const dot = (on: boolean) =>
    on ? <span style={{ color: "#16a34a" }}>●</span> : <span style={{ color: "#dc2626" }}>○</span>;
  return <>{dot(!!smog)} {dot(!!detail)} {dot(!!inspected)} {dot(!!pics)}</>;
}

function fmtVin(vin: string | null) {
  if (!vin) return "···??????????";
  const display = "···" + vin.slice(-10).toUpperCase();
  return <>{display.slice(0, -6)}<strong>{display.slice(-6)}</strong></>;
}

function fmtMargin(selling: number | null, cost: number | null) {
  if (selling == null || cost == null) return "—";
  const m = selling - cost;
  if (m < 0) return <span style={{ color: "#dc2626" }}>({Math.abs(m / 1000).toFixed(1)}K)</span>;
  return <span style={{ color: "#16a34a" }}>${(m / 1000).toFixed(1)}K</span>;
}

function fmtInDate(inventoryDate: string | null, dom: number | null): string {
  if (!inventoryDate) return "—";
  const d = new Date(inventoryDate);
  if (isNaN(d.getTime())) return "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  const dateStr = `${mm}/${dd}/${yyyy}`;
  return dom != null ? `${dateStr} (${dom})` : dateStr;
}

export interface Vehicle {
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
  inventory_date: string | null;
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

export default function InventoryTable({
  grouped,
}: {
  grouped: Record<string, Vehicle[]>;
}) {
  const [mode, setMode] = useState<"price" | "notes">("price");
  const showPrice = mode === "price";
  const colSpan = showPrice ? 11 : 8;

  return (
    <>
      <div className="mode-toggle no-print">
        <label>
          <input
            type="radio"
            name="print-mode"
            checked={mode === "price"}
            onChange={() => setMode("price")}
          />{" "}
          Price / Cost
        </label>
        <label style={{ marginLeft: "16px" }}>
          <input
            type="radio"
            name="print-mode"
            checked={mode === "notes"}
            onChange={() => setMode("notes")}
          />{" "}
          Notes
        </label>
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
            <th className="col-indate">In-Date</th>
            {showPrice ? (
              <>
                <th className="col-cost">Cost</th>
                <th className="col-price">Price</th>
                <th className="col-net">Net</th>
                <th className="col-margin">Margin</th>
              </>
            ) : (
              <th className="col-notes">Notes</th>
            )}
          </tr>
        </thead>
        <tbody>
          {SECTION_ORDER.flatMap((section) => {
            const items = grouped[section];
            if (!items || items.length === 0) return [];

            // sort items by last 6 of vin. This makes them easy to find when walking the lot
            const itemsSorted = [...items].sort((a, b) => {
              const aKey = (a.vin || "").slice(-6).toUpperCase();
              const bKey = (b.vin || "").slice(-6).toUpperCase();
              return aKey.localeCompare(bKey);
            });

            return [
              <tr key={`header-${section}`} className="section-row">
                <td colSpan={colSpan} className="section-label">
                  {SECTION_LABELS[section]} ({items.length})
                </td>
              </tr>,
              ...itemsSorted.map((v) => (
                <tr key={v.stock_number || v.vin || Math.random()}>
                  <td className="col-stock">{v.stock_number || "—"}</td>
                  <td className="col-vehicle">{vehicleName(v)}</td>
                  <td className="col-color">{v.color || "—"}</td>
                  <td className="col-miles">{fmtMiles(v.mileage)}</td>
                  <td className="col-sdi">
                    {fmtSdiP(v.smog_done, v.detail_done, v.inspected_done, v.pics_taken)}
                  </td>
                  <td className="col-vin">{fmtVin(v.vin)}</td>
                  <td className="col-indate">{fmtInDate(v.inventory_date, v.dom)}</td>
                  {showPrice ? (
                    <>
                      <td className="col-cost">{fmtK(v.total_cost)}</td>
                      <td className="col-price">{fmtK(v.selling_price)}</td>
                      <td className="col-net">{fmtK(v.internet_price)}</td>
                      <td className="col-margin">{fmtMargin(v.selling_price, v.total_cost)}</td>
                    </>
                  ) : (
                    <td className="col-notes">&nbsp;</td>
                  )}
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </>
  );
}
