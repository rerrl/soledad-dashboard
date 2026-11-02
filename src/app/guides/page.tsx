"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import BuyersGuideModal from "../components/BuyersGuideModal";
import {
  DEFAULT_SORT,
  filterVehicles,
  formatMileage,
  formatPrice,
  formatUpdatedAt,
  sortVehicles,
  type LibraryResponse,
  type LibraryVehicle,
  type SortDirection,
  type SortKey,
} from "@/lib/library";

/**
 * /guides — the salesmen library.
 *
 * One tool on a clean page: the whole vehicle set of the latest DeskManager
 * batch in a single sortable/filterable table, each row able to print its
 * Buyers Guide. Deliberately no nav to the rest of the app (salesmen land here
 * and stay here), no lanes, no stats — just the list they actually work from.
 *
 * Filtering and sorting happen client-side (the data set is a few dozen rows),
 * in the pure helpers in src/lib/library.ts.
 */

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "year", label: "Year", numeric: true },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "series", label: "Series" },
  { key: "stock", label: "Stock #" },
  { key: "vin", label: "VIN" },
  { key: "mileage", label: "Mileage", numeric: true },
  { key: "price", label: "Price", numeric: true },
  { key: "dom", label: "Days on Lot", numeric: true },
];

const fetchLibrary = (): Promise<LibraryResponse> =>
  fetch("/api/vehicles/library").then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<LibraryResponse>;
  });

export default function GuidesPage() {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT.key);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_SORT.direction,
  );
  // Stock number whose Buyers Guide is being printed (null = modal closed).
  const [printStock, setPrintStock] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<LibraryResponse>({
    queryKey: ["library"],
    queryFn: fetchLibrary,
  });

  const vehicles = useMemo(() => data?.vehicles ?? [], [data]);

  const visible = useMemo(
    () => sortVehicles(filterVehicles(vehicles, filter), sortKey, sortDirection),
    [vehicles, filter, sortKey, sortDirection],
  );

  const hasVehicles = vehicles.length > 0;
  const filterActive = filter.trim().length > 0;

  // Clicking a header sorts by it; clicking the active header flips the
  // direction. A newly chosen column starts ascending.
  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <div className="min-h-screen bg-[var(--sol-bg)] text-[var(--sol-text)]">
      <header className="border-b border-[var(--sol-border)] bg-[var(--sol-card)] px-6 py-5">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--sol-accent)]">
              Soledad LotOps
            </h1>
            <p className="mt-0.5 text-sm text-[var(--sol-muted)]">
              Buyers Guide Library
            </p>
          </div>
          <p className="text-sm text-[var(--sol-muted)]">
            Vehicle set updated @{" "}
            <span className="text-[var(--sol-text)]">
              {isLoading ? "…" : formatUpdatedAt(data?.updatedAt ?? null)}
            </span>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[110rem] px-6 py-6">
        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xl">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter — try “Toyota 2023”, a stock # or part of a VIN"
              aria-label="Filter vehicles"
              autoFocus
              className="w-full rounded-lg border border-[var(--sol-border)] bg-[var(--sol-card)] py-2.5 pl-3 pr-10 text-base text-[var(--sol-text)] placeholder:text-[var(--sol-dim)] transition-colors hover:border-[var(--sol-accent)] focus:border-[var(--sol-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--sol-accent)]"
            />
            {filter.length > 0 && (
              <button
                type="button"
                onClick={() => setFilter("")}
                aria-label="Clear filter"
                title="Clear filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-lg leading-none text-[var(--sol-muted)] transition-colors hover:text-[var(--sol-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)]"
              >
                ✕
              </button>
            )}
          </div>
          {hasVehicles && (
            <p className="text-sm text-[var(--sol-muted)]">
              {filterActive
                ? `${visible.length} of ${vehicles.length} vehicles`
                : `${vehicles.length} vehicles`}
            </p>
          )}
        </div>

        {/* Table */}
        <div className="max-h-[calc(100vh-13rem)] overflow-auto rounded-lg border border-[var(--sol-border)]">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                {COLUMNS.map((column) => {
                  const active = column.key === sortKey;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        active
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className={`whitespace-nowrap border-b border-[var(--sol-border)] bg-[var(--sol-surface)] p-0 text-left font-semibold ${
                        column.numeric ? "text-right" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(column.key)}
                        title={`Sort by ${column.label}`}
                        className={`flex w-full items-center gap-1.5 px-3 py-2.5 transition-colors hover:text-[var(--sol-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sol-accent)] ${
                          column.numeric ? "justify-end" : ""
                        } ${active ? "text-[var(--sol-accent)]" : "text-[var(--sol-muted)]"}`}
                      >
                        {column.label}
                        <span aria-hidden="true" className="text-xs">
                          {active ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                        </span>
                      </button>
                    </th>
                  );
                })}
                <th
                  scope="col"
                  className="whitespace-nowrap border-b border-[var(--sol-border)] bg-[var(--sol-surface)] px-3 py-2.5 text-right font-semibold text-[var(--sol-muted)]"
                >
                  Print
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={COLUMNS.length + 1}
                    className="px-3 py-10 text-center text-[var(--sol-muted)]"
                  >
                    Loading vehicles…
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td
                    colSpan={COLUMNS.length + 1}
                    className="px-3 py-10 text-center text-[var(--sol-red)]"
                  >
                    Couldn&apos;t load the vehicle list. Refresh to try again.
                  </td>
                </tr>
              )}

              {!isLoading && !isError && !hasVehicles && (
                <tr>
                  <td
                    colSpan={COLUMNS.length + 1}
                    className="px-3 py-10 text-center text-[var(--sol-muted)]"
                  >
                    No vehicles found
                  </td>
                </tr>
              )}

              {!isLoading && !isError && hasVehicles && visible.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMNS.length + 1}
                    className="px-3 py-10 text-center text-[var(--sol-muted)]"
                  >
                    No matches — clear the filter
                  </td>
                </tr>
              )}

              {visible.map((vehicle) => (
                <VehicleRow
                  key={vehicle.stock_number}
                  vehicle={vehicle}
                  onPrint={() => setPrintStock(vehicle.stock_number)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {printStock !== null && (
        <BuyersGuideModal stock={printStock} onClose={() => setPrintStock(null)} />
      )}
    </div>
  );
}

function VehicleRow({
  vehicle,
  onPrint,
}: {
  vehicle: LibraryVehicle;
  onPrint: () => void;
}) {
  return (
    <tr className="border-b border-[var(--sol-border)] transition-colors duration-100 last:border-b-0 hover:bg-[var(--sol-surface)]">
      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
        {vehicle.dm_year ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">{vehicle.dm_make ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2.5">{vehicle.dm_model ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2.5">{vehicle.dm_series ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-[var(--sol-accent)]">
        {vehicle.stock_number}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
        {vehicle.dm_vin ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
        {formatMileage(vehicle.dm_mileage)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
        {formatPrice(vehicle.dm_selling_price)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
        {vehicle.dom ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={onPrint}
          aria-label={`Print Buyers Guide for stock ${vehicle.stock_number}`}
          className="rounded border border-[var(--sol-border)] px-2.5 py-1 text-xs font-medium text-[var(--sol-text)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--sol-accent)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)]"
        >
          Print Buyers Guide
        </button>
      </td>
    </tr>
  );
}
