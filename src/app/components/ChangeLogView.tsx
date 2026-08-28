"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChangeLogEntry {
  id: number;
  change_type: string;
  vin: string;
  stock_number: string | null;
  make: string;
  model: string;
  year: number;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  viewed_at: string | null;
  created_at: string;
}

interface ChangeLogBatch {
  imported_at: string;
  batch_viewed: boolean;
  count: number;
  entries: ChangeLogEntry[];
}

interface ChangeLogResponse {
  batches: ChangeLogBatch[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = (path: string) => path;

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const badge = (type: string) => {
  switch (type) {
    case "added":
      return <span className="bg-green-900/60 text-green-300 text-xs font-medium px-2 py-0.5 rounded">Added</span>;
    case "removed":
      return <span className="bg-red-900/60 text-red-300 text-xs font-medium px-2 py-0.5 rounded">Removed</span>;
    case "updated":
      return <span className="bg-yellow-900/40 text-yellow-300 text-xs font-medium px-2 py-0.5 rounded">Updated</span>;
    case "flagged":
      return <span className="bg-red-900/40 text-red-300 text-xs font-medium px-2 py-0.5 rounded">Flagged</span>;
    default:
      return <span className="text-slate-400 text-xs">{type}</span>;
  }
};

// ── Change Log View ───────────────────────────────────────────────────────────

export default function ChangeLogView() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unhandled">("all");
  const [copyMsg, setCopyMsg] = useState<Record<number, boolean>>({});
  const [dismissing, setDismissing] = useState<Set<number>>(new Set());

  const { data, isLoading, error } = useQuery<ChangeLogResponse>({
    queryKey: ["change-log"],
    queryFn: () => fetch(API("/api/change-log")).then((r) => r.json()),
    refetchInterval: 30000,
  });

  const markViewedMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(API(`/api/change-log/${id}/view`), { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-log"] });
    },
  });

  const dismissBatchMutation = useMutation({
    mutationFn: (imported_at: string) =>
      fetch(API("/api/change-log/batch-view"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imported_at }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-log"] });
    },
  });

  const handleCopyVin = async (vin: string, entryId: number) => {
    try {
      await navigator.clipboard.writeText(vin);
      setCopyMsg((prev) => ({ ...prev, [entryId]: true }));
      setTimeout(() => {
        setCopyMsg((prev) => ({ ...prev, [entryId]: false }));
      }, 1500);
    } catch {
      // Clipboard API may not be available
    }
  };

  const handleDismiss = async (id: number) => {
    setDismissing((prev) => new Set(prev).add(id));
    markViewedMutation.mutate(id, {
      onSettled: () => {
        setDismissing((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      },
    });
  };

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

  const batches = data?.batches ?? [];

  // Apply client-side filter
  const visibleBatches = filter === "unhandled"
    ? batches.filter((b) => !b.batch_viewed)
    : batches;

  if (batches.length === 0) {
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
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--sol-muted)]">Show:</span>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-[var(--sol-accent)] text-white"
                : "bg-[var(--sol-surface)] text-[var(--sol-muted)] hover:bg-[var(--sol-border)]"
            }`}
          >
            All ({batches.length})
          </button>
          <button
            onClick={() => setFilter("unhandled")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === "unhandled"
                ? "bg-[var(--sol-accent)] text-white"
                : "bg-[var(--sol-surface)] text-[var(--sol-muted)] hover:bg-[var(--sol-border)]"
            }`}
          >
            Unhandled ({batches.filter((b) => !b.batch_viewed).length})
          </button>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["change-log"] })}
          className="bg-[var(--sol-surface)] hover:bg-[var(--sol-border)] text-[var(--sol-text)] px-3 py-1.5 rounded text-xs font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Batches */}
      {visibleBatches.length === 0 && (
        <div className="text-center py-12 text-[var(--sol-dim)] text-sm">
          All changes handled. Good work.
        </div>
      )}

      <div className="space-y-3">
        {visibleBatches.map((batch) => (
          <div
            key={batch.imported_at}
            className={`rounded-lg border ${
              batch.batch_viewed
                ? "border-[var(--sol-border)]/30"
                : "border-[var(--sol-border)]"
            } overflow-hidden bg-[var(--sol-card)]`}
          >
            {/* Batch header */}
            <div
              className={`flex items-center justify-between px-4 py-2 border-b ${
                batch.batch_viewed
                  ? "border-[var(--sol-border)]/30 bg-[var(--sol-surface)]/30"
                  : "border-[var(--sol-border)] bg-[var(--sol-surface)]/80"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--sol-muted)]">
                  {batch.imported_at ? fmtTime(batch.imported_at) : "Unknown"}
                </span>
                <span className="text-xs text-[var(--sol-dim)]">
                  {batch.count} change{batch.count !== 1 ? "s" : ""}
                </span>
                {batch.batch_viewed && (
                  <span className="text-xs text-[var(--sol-dim)] italic">handled</span>
                )}
              </div>
              {!batch.batch_viewed && (
                <button
                  onClick={() => dismissBatchMutation.mutate(batch.imported_at)}
                  className="text-xs text-[var(--sol-muted)] hover:text-[var(--sol-text)] transition-colors"
                >
                  Dismiss all
                </button>
              )}
            </div>

            {/* Entries */}
            <div className="divide-y divide-[var(--sol-border)]">
              {batch.entries.map((e) => {
                const vehicleLabel = `${e.year} ${e.make} ${e.model}`;
                return (
                  <div
                    key={e.id}
                    className={`flex items-center gap-3 px-4 py-2 text-sm ${
                      e.viewed_at ? "opacity-40" : ""
                    }`}
                  >
                    {badge(e.change_type)}
                    <span className="text-[var(--sol-text)] min-w-0 shrink-0">
                      {vehicleLabel}
                    </span>
                    <span className="text-[var(--sol-dim)] font-mono text-xs truncate">
                      {e.vin}
                    </span>
                    <button
                      onClick={() => handleCopyVin(e.vin, e.id)}
                      className="text-xs text-[var(--sol-muted)] hover:text-[var(--sol-accent)] transition-colors shrink-0"
                      title="Copy VIN"
                    >
                      {copyMsg[e.id] ? "✓" : "📋"}
                    </button>
                    {e.stock_number && (
                      <span className="text-[var(--sol-dim)] text-xs shrink-0">
                        #{e.stock_number}
                      </span>
                    )}
                    <span className="flex-1" />
                    {e.change_type === "updated" && e.field_name && (
                      <div className="flex items-center gap-1.5 text-xs shrink-0">
                        <span className="text-[var(--sol-muted)]">{e.field_name}:</span>
                        <span className="text-[var(--sol-red)] line-through">{e.old_value ?? "—"}</span>
                        <span className="text-[var(--sol-dim)]">&rarr;</span>
                        <span className="text-[var(--sol-green)]">{e.new_value ?? "—"}</span>
                      </div>
                    )}
                    {e.change_type === "flagged" && e.field_name && (
                      <div className="flex items-center gap-1.5 text-xs shrink-0">
                        <span className="text-[var(--sol-muted)]">{e.field_name.replace("_done", "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}:</span>
                        <span className="text-[var(--sol-green)]">App ✓</span>
                        <span className="text-[var(--sol-dim)]">/</span>
                        <span className="text-[var(--sol-red)]">DeskManager ✗</span>
                      </div>
                    )}
                    {!e.viewed_at && (
                      <button
                        onClick={() => handleDismiss(e.id)}
                        disabled={dismissing.has(e.id)}
                        className="text-xs text-[var(--sol-muted)] hover:text-[var(--sol-green)] disabled:text-[var(--sol-dim)] transition-colors shrink-0 ml-2"
                      >
                        {dismissing.has(e.id) ? "..." : "Mark handled"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}