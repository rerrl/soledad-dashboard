"use client";

import { useState } from "react";

function fmtK(n: number | null): string {
  if (n == null) return "—";
  return `$${(n / 1000).toFixed(1)}K`;
}

/** Full-dollar format — used by the Repricing view where exact values matter. */
function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * Difference between our price and KBB retail, rendered in parens for the
 * Repricing view. Green when we're under retail, red when we're over it.
 */
function fmtSpread(price: number | null, retail: number | null) {
  if (price == null || retail == null) return null;
  const d = Math.round(price) - Math.round(retail);
  if (d === 0) return null;
  const over = d > 0;
  return (
    <span style={{ color: over ? "#dc2626" : "#16a34a", whiteSpace: "nowrap" }}>
      ({over ? "+" : "-"}
      {fmtUsd(Math.abs(d))})
    </span>
  );
}

function fmtMiles(n: number | null): string {
  if (n == null) return "—";
  return `${(n / 1000).toFixed(1)}K`;
}

function fmtSdiP(
  smog: number | null,
  detail: number | null,
  inspected: number | null,
  supplement: Record<string, number | null>,
) {
  const dot = (on: boolean | null) =>
    on ? <span style={{ color: "#16a34a" }}>●</span> : <span style={{ color: "#dc2626" }}>○</span>;

  // Printout groups the 8 status dots for legibility:  F/BG — S/D/I — P/AC/WS
  const groups: { dots: { value: boolean | null; title: string }[] }[] = [
    {
      dots: [
        { value: !!supplement["folder"], title: "Folder" },
        { value: !!supplement["buyers_guide"], title: "Buyers Guide" },
      ],
    },
    {
      dots: [
        { value: !!smog, title: "Smog" },
        { value: !!detail, title: "Detail" },
        { value: !!inspected, title: "Inspected" },
      ],
    },
    {
      dots: [
        { value: !!supplement["pics_taken"], title: "Pics Taken" },
        { value: !!supplement["account_center"], title: "Account Center" },
        { value: !!supplement["window_sticker"], title: "Window Sticker" },
      ],
    },
  ];

  const sep = <span style={{ color: "#9ca3af" }}> — </span>;

  return (
    <>
      {groups.map((g, gi) => (
        <span key={gi} style={{ whiteSpace: "nowrap" }}>
          {gi > 0 ? sep : null}
          {g.dots.map((d) => (
            <span key={d.title} title={d.title}>
              {dot(d.value)}{" "}
            </span>
          ))}
        </span>
      ))}
    </>
  );
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

/**
 * Format a stored ISO date (YYYY-MM-DD, optionally with a time suffix) as
 * MM/DD/YYYY by string slicing — never via `new Date()`, which would parse a
 * bare date as UTC midnight and then report the local (PDT/UTC-7) calendar
 * day, displaying dates one day early.
 */
function fmtIsoDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

function fmtInDate(inventoryDate: string | null, dom: number | null): string {
  const dateStr = fmtIsoDate(inventoryDate);
  if (!dateStr) return "—";
  return dom != null ? `${dateStr} (${dom})` : dateStr;
}

function fmtDate(dateStr: string | null): string {
  return fmtIsoDate(dateStr) ?? "—";
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
  folder: number | null;
  account_center: number | null;
  buyers_guide: number | null;
  window_sticker: number | null;
  status: string;
  inventory_date: string | null;
  dom: number | null;
  wholesale_value: number | null;
  retail_value: number | null;
  valuation_date: string | null;
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
  const [mode, setMode] = useState<"price" | "notes" | "repricing">("price");
  const showPrice = mode === "price";
  const showRepricing = mode === "repricing";
  const colSpan = showPrice ? 11 : showRepricing ? 10 : 8;

  const MODES: { key: typeof mode; label: string }[] = [
    { key: "price", label: "Price / Cost" },
    { key: "notes", label: "Notes" },
    { key: "repricing", label: "Repricing" },
  ];

  return (
    <>
      <div className="mode-toggle no-print">
        {MODES.map((m, i) => (
          <label key={m.key} style={i > 0 ? { marginLeft: "16px" } : undefined}>
            <input
              type="radio"
              name="print-mode"
              checked={mode === m.key}
              onChange={() => setMode(m.key)}
            />{" "}
            {m.label}
          </label>
        ))}
      </div>

      <table className={showRepricing ? "table-repricing" : undefined}>
        <thead>
          <tr>
            <th className="col-stock">Stock</th>
            <th className="col-vehicle">Vehicle</th>
            <th className="col-color">Color</th>
            {showRepricing ? (
              <>
                <th className="col-age">Age</th>
                <th className="col-cost">Total Cost</th>
                <th className="col-usd">Wholesale</th>
                <th className="col-usd">Retail</th>
                <th className="col-usd">Asking</th>
                <th className="col-usd">Internet</th>
                <th className="col-valdate">Val Date</th>
              </>
            ) : (
              <>
                <th className="col-miles">Mi</th>
                <th className="col-sdi">F/BG — S/D/I — P/AC/WS</th>
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
              </>
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
                  {showRepricing ? (
                    <>
                      <td className="col-age">{v.dom ?? "—"}</td>
                      <td className="col-cost">{fmtUsd(v.total_cost)}</td>
                      <td className="col-usd">{fmtUsd(v.wholesale_value)}</td>
                      <td className="col-usd">{fmtUsd(v.retail_value)}</td>
                      <td className="col-usd">
                        {fmtUsd(v.selling_price)} {fmtSpread(v.selling_price, v.retail_value)}
                      </td>
                      <td className="col-usd">
                        {fmtUsd(v.internet_price)} {fmtSpread(v.internet_price, v.retail_value)}
                      </td>
                      <td className="col-valdate">{fmtDate(v.valuation_date)}</td>
                    </>
                  ) : (
                    <>
                      <td className="col-miles">{fmtMiles(v.mileage)}</td>
                      <td className="col-sdi">
                        {fmtSdiP(v.smog_done, v.detail_done, v.inspected_done, {
                          pics_taken: v.pics_taken,
                          folder: v.folder,
                          account_center: v.account_center,
                          buyers_guide: v.buyers_guide,
                          window_sticker: v.window_sticker,
                        })}
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
                    </>
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
