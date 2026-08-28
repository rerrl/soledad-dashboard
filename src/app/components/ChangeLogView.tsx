"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChangeLogEntry {
  id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_type: string;
  viewed_at: string | null;
  source: string;
  created_at: string;
}

interface VehicleGroup {
  stock_number: string | null;
  vin: string;
  make: string;
  model: string;
  year: number;
  vehicle_id: number;
  changes: ChangeLogEntry[];
  has_unviewed: boolean;
  most_recent_change: string;
}

interface ChangeLogResponse {
  groups: VehicleGroup[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = (path: string) => path;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString() : "—";

const fmtTime = (d: string) =>
  new Date(d).toLocaleString();

const fieldLabel = (f: string): string => {
  const labels: Record<string, string> = {
    vehicle_added: "Vehicle Added",
    smog_done: "Smog",
    detail_done: "Detail",
    inspected_done: "Inspected",
    selling_price: "Selling Price",
    total_cost: "Total Cost",
    internet_price: "Internet Price",
    mileage: "Mileage",
    color: "Color",
    series: "Series",
    year: "Year",
    make: "Make",
    model: "Model",
    vin: "VIN",
    imported_at: "Imported At",
  };
  return labels[f] ?? f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

// ── Change Log View ───────────────────────────────────────────────────────────

export default function ChangeLogView() {
  const queryClient = useQueryClient();
  const [expandedStock, setExpandedStock] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ChangeLogResponse>({
    queryKey: ["change-log"],
    queryFn: () => fetch(API("/api/change-log")).then((r) => r.json()),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const markViewedMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(API(`/api/change-log/${id}/view`), { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-log"] });
    },
  });

  const markVehicleViewedMutation = useMutation({
    mutationFn: (vehicleId: number) =>
      fetch(API(`/api/change-log/vehicle/${vehicleId}/view`), { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-log"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 bg-[var(--sol-bg)] text-[var(--sol-text)] min-h-screen">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg p-4 bg-[var(--sol-card)]">
              <div className="h-5 w-40 rounded mb-3 bg-[var(--sol-skeleton)]" />
              <div className="h-3 w-64 rounded mb-2 bg-[var(--sol-skeleton)]" />
              <div className="h-3 w-48 rounded bg-[var(--sol-skeleton)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-6 bg-[var(--sol-bg)] text-[var(--sol-text)] min-h-screen">
        <div className="rounded-lg p-4 bg-[var(--sol-card)] border border-[var(--sol-red)]">
          <p className="text-[var(--sol-red)]">Failed to load change log.</p>
        </div>
      </div>
    );
  }

  const groups = data?.groups ?? [];

  if (groups.length === 0) {
    return (
      <div className="p-4 lg:p-6 bg-[var(--sol-bg)] text-[var(--sol-text)] min-h-screen">
        <div className="rounded-lg p-8 bg-[var(--sol-card)] border border-[var(--sol-border)] text-center">
          <p className="text-lg mb-2 text-[var(--sol-muted)]">No changes yet</p>
          <p className="text-sm text-[var(--sol-dim)]">
            Import a CSV to see your change history.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-[var(--sol-bg)] text-[var(--sol-text)] min-h-screen">
      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={`${group.vehicle_id}-${group.stock_number}`}
            className="rounded-lg bg-[var(--sol-card)] border border-[var(--sol-border)] overflow-hidden"
          >
            {/* Vehicle header */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:opacity-85 transition-opacity"
              onClick={() =>
                setExpandedStock(
                  expandedStock === group.stock_number ? null : group.stock_number
                )
              }
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-[var(--sol-accent)]">
                  {group.make} {group.model}
                </span>
                <span className="text-xs text-[var(--sol-muted)]">
                  {group.year} · {group.stock_number ?? "—"}
                </span>
                {group.has_unviewed && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400 font-medium">
                    Needs attention
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {group.has_unviewed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markVehicleViewedMutation.mutate(group.vehicle_id);
                    }}
                    className="text-xs px-2 py-1 rounded bg-[var(--sol-surface)] hover:bg-[var(--sol-border)] text-[var(--sol-text)] transition-colors"
                  >
                    Mark all viewed
                  </button>
                )}
                <span className="text-xs text-[var(--sol-dim)]">
                  {expandedStock === group.stock_number ? "▲" : "▼"}
                </span>
              </div>
            </div>

            {/* Changes */}
            {expandedStock === group.stock_number && (
              <div className="border-t border-[var(--sol-border)]">
                {group.changes.map((change) => (
                  <div
                    key={change.id}
                    className={`flex items-center justify-between px-4 py-2 text-sm border-b border-[var(--sol-border)] last:border-b-0 transition-all duration-150 ${
                      change.viewed_at
                        ? "opacity-40"
                        : change.change_type === "flagged"
                        ? "bg-yellow-900/10 border-l-2 border-l-yellow-500"
                        : change.change_type === "added"
                        ? "bg-blue-900/10 border-l-2 border-l-blue-500"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Unviewed dot — shows on all unviewed items */}
                      {!change.viewed_at && (
                        <span className="text-slate-400 text-xs flex-shrink-0">●</span>
                      )}
                      {/* Change-type specific icon — only on unviewed */}
                      {!change.viewed_at && change.change_type === "flagged" && (
                        <span className="text-yellow-400 text-xs flex-shrink-0">⚠</span>
                      )}
                      {!change.viewed_at && change.change_type === "added" && (
                        <span className="text-blue-400 text-xs flex-shrink-0">✦</span>
                      )}
                      <span
                        className={`text-xs font-medium flex-shrink-0 ${
                          change.viewed_at
                            ? "text-[var(--sol-dim)] line-through"
                            : "text-[var(--sol-muted)]"
                        }`}
                      >
                        {fieldLabel(change.field_name)}
                      </span>
                      <span
                        className={`text-xs truncate ${
                          change.viewed_at ? "text-[var(--sol-dim)] line-through" : "text-[var(--sol-dim)]"
                        }`}
                      >
                        {change.change_type === "added" ? (
                          <span className={change.viewed_at ? "text-[var(--sol-dim)]" : "text-[var(--sol-green)]"}>
                            {change.new_value}
                          </span>
                        ) : change.change_type === "flagged" ? (
                          change.viewed_at ? (
                            <span className="text-[var(--sol-dim)]">App: ✓ DeskManager: ✗</span>
                          ) : (
                            <span>
                              App: <span className="text-[var(--sol-green)]">✓</span>{" "}
                              DeskManager: <span className="text-[var(--sol-red)]">✗</span>
                            </span>
                          )
                        ) : (
                          <span>
                            <span className={`${change.viewed_at ? "" : "line-through"} text-[var(--sol-muted)]`}>
                              {change.old_value ?? "—"}
                            </span>{" "}
                            →{" "}
                            <span className={change.viewed_at ? "text-[var(--sol-dim)]" : "text-[var(--sol-green)]"}>
                              {change.new_value ?? "—"}
                            </span>
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs ${change.viewed_at ? "text-[var(--sol-dim)]" : "text-[var(--sol-dim)]"}`}>
                        {change.viewed_at ? (
                          <span className="text-[var(--sol-dim)]">✓ viewed</span>
                        ) : (
                          fmtTime(change.created_at)
                        )}
                      </span>
                      {!change.viewed_at && (
                        <button
                          onClick={() => markViewedMutation.mutate(change.id)}
                          className="text-xs px-1.5 py-0.5 rounded bg-[var(--sol-surface)] hover:bg-[var(--sol-border)] text-[var(--sol-muted)] transition-colors"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}