"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChangeLogEntry {
  id: number;
  change_type: string;
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
    default:
      return <span className="text-slate-400 text-xs">{type}</span>;
  }
};

// ── Windowing ─────────────────────────────────────────────────────────────────
//
// The change log grows forever, so rendering every batch and entry is what makes
// the screen slow — a 20k-entry log is ~135k DOM nodes. Instead we flatten the
// batches into a single list of fixed-height rows and only mount the slice that
// sits inside the viewport (plus a small overscan), offsetting the rendered
// block with a translateY so the scrollbar still reflects the full list.
//
// Rows are deliberately fixed-height: every row is single-line (labels are
// `shrink-0`, nothing wraps), so the height is a constant and the window math is
// exact. Heights are set inline so what we declare is what actually renders.

const ROW_H = 37; // one entry row  (px-4 py-2 text-sm, measured)
const HEADER_H = 33; // one batch header (px-4 py-2, measured)
const GAP_H = 12; // space between batches (was space-y-3)
const OVERSCAN = 10; // rows rendered beyond the viewport, each side

type VRow =
  | { kind: "header"; key: string; batch: ChangeLogBatch }
  | {
      kind: "entry";
      key: string;
      entry: ChangeLogEntry;
      batchViewed: boolean;
      first: boolean;
      last: boolean;
    }
  | { kind: "gap"; key: string };

const rowHeight = (r: VRow) =>
  r.kind === "header" ? HEADER_H : r.kind === "entry" ? ROW_H : GAP_H;

/** Flatten batches into a fixed-height row list (headers, entries, gaps). */
function buildRows(batches: ChangeLogBatch[]): VRow[] {
  const rows: VRow[] = [];
  batches.forEach((batch, bi) => {
    rows.push({ kind: "header", key: `h-${batch.imported_at}-${bi}`, batch });
    batch.entries.forEach((entry, ei) => {
      rows.push({
        kind: "entry",
        key: `e-${entry.id}`,
        entry,
        batchViewed: batch.batch_viewed,
        first: ei === 0,
        last: ei === batch.entries.length - 1,
      });
    });
    if (bi < batches.length - 1) rows.push({ kind: "gap", key: `g-${bi}` });
  });
  return rows;
}

/** Index of the last row starting at or before `y`. Rows are sorted, so binary search. */
function findRowAt(offsets: number[], y: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= y) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

// ── Change Log View ───────────────────────────────────────────────────────────

export default function ChangeLogView() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unhandled">("all");
  const [dismissing, setDismissing] = useState<Set<number>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(600);

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

  // Filter out flagged entries — they're noise until the underlying issue is fixed
  const cleanBatches = useMemo(() => {
    const rawBatches = data?.batches ?? [];
    return rawBatches
      .map((b) => ({
        ...b,
        entries: b.entries.filter((e) => e.change_type !== "flagged"),
      }))
      .filter((b) => b.entries.length > 0)
      .map((b) => ({ ...b, count: b.entries.length }));
  }, [data]);

  // Apply client-side filter
  const visibleBatches = useMemo(
    () => (filter === "unhandled" ? cleanBatches.filter((b) => !b.batch_viewed) : cleanBatches),
    [filter, cleanBatches],
  );

  const rows = useMemo(() => buildRows(visibleBatches), [visibleBatches]);

  // Prefix-sum of row offsets — lets us binary-search the first visible row.
  const { offsets, totalH } = useMemo(() => {
    const off = new Array<number>(rows.length);
    let acc = 0;
    for (let i = 0; i < rows.length; i++) {
      off[i] = acc;
      acc += rowHeight(rows[i]);
    }
    return { offsets: off, totalH: acc };
  }, [rows]);

  // Track scroll position and viewport height.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => setScrollTop(el.scrollTop);
    const measure = () => {
      // Fit the list to the remaining window so only one thing scrolls.
      const top = el.getBoundingClientRect().top;
      const avail = Math.max(240, window.innerHeight - top - 16);
      setViewportH(avail);
      el.style.height = `${avail}px`;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    measure();

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isLoading, error]);

  // Changing the filter swaps out the whole row list, so reset the scroll in the
  // handler — leaving it put would apply the window math to a scroll position
  // that belongs to the previous list.
  const applyFilter = (next: "all" | "unhandled") => {
    setFilter(next);
    setScrollTop(0);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const windowed = useMemo(() => {
    if (rows.length === 0) {
      return { start: 0, end: 0, offset: 0, slice: [] as VRow[] };
    }
    const first = findRowAt(offsets, Math.max(0, scrollTop - OVERSCAN * ROW_H));
    const start = Math.max(0, first - OVERSCAN);
    const limit = scrollTop + viewportH + OVERSCAN * ROW_H;
    let end = start;
    while (end < rows.length && offsets[end] < limit) end++;
    // Keep a floor on rendered rows so a tall viewport never paints blank.
    end = Math.min(rows.length, Math.max(end, start + 1));
    return { start, end, offset: offsets[start] ?? 0, slice: rows.slice(start, end) };
  }, [rows, offsets, scrollTop, viewportH]);

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

  if (cleanBatches.length === 0) {
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

  const renderRow = (r: VRow) => {
    if (r.kind === "gap") {
      return <div key={r.key} data-vrow="gap" style={{ height: GAP_H }} />;
    }

    if (r.kind === "header") {
      const { batch } = r;
      return (
        <div
          key={r.key}
          data-vrow="header"
          style={{ height: HEADER_H }}
          className={`flex items-center justify-between px-4 rounded-t-lg border ${
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
      );
    }

    const e = r.entry;
    const vehicleLabel = `${e.year} ${e.make} ${e.model}`;
    // Rebuild the box the old wrapper used to draw: side borders on every row,
    // a top divider on every entry but the first (was `divide-y`), and the
    // bottom edge + rounded corners only on a batch's last row.
    const border = r.batchViewed ? "border-[var(--sol-border)]/30" : "border-[var(--sol-border)]";
    return (
      <div
        key={r.key}
        data-vrow="entry"
        style={{ height: ROW_H }}
        className={`flex items-center gap-3 px-4 text-sm border-l border-r ${border} ${
          r.first ? "" : "border-t border-[var(--sol-border)]"
        } ${r.last ? `border-b rounded-b-lg` : ""} overflow-hidden ${
          e.viewed_at ? "opacity-40" : ""
        }`}
      >
        {badge(e.change_type)}
        <span className="text-[var(--sol-text)] min-w-0 shrink-0">{vehicleLabel}</span>
        {e.stock_number && (
          <span className="text-[var(--sol-dim)] text-xs shrink-0">#{e.stock_number}</span>
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
  };

  return (
    <div className="p-4 lg:p-6 bg-[var(--sol-bg)] text-[var(--sol-text)]">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--sol-muted)]">Show:</span>
          <button
            onClick={() => applyFilter("all")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-[var(--sol-accent)] text-white"
                : "bg-[var(--sol-surface)] text-[var(--sol-muted)] hover:bg-[var(--sol-border)]"
            }`}
          >
            All ({cleanBatches.length})
          </button>
          <button
            onClick={() => applyFilter("unhandled")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === "unhandled"
                ? "bg-[var(--sol-accent)] text-white"
                : "bg-[var(--sol-surface)] text-[var(--sol-muted)] hover:bg-[var(--sol-border)]"
            }`}
          >
            Unhandled ({cleanBatches.filter((b) => !b.batch_viewed).length})
          </button>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["change-log"] })}
          className="bg-[var(--sol-surface)] hover:bg-[var(--sol-border)] text-[var(--sol-text)] px-3 py-1.5 rounded text-xs font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {visibleBatches.length === 0 && (
        <div className="text-center py-12 text-[var(--sol-dim)] text-sm">
          All changes handled. Good work.
        </div>
      )}

      {/* Windowed list — only the rows inside the viewport are mounted. */}
      <div ref={scrollRef} className="overflow-y-auto overflow-x-hidden" data-testid="change-log-scroller">
        <div style={{ height: totalH, position: "relative" }}>
          <div style={{ transform: `translateY(${windowed.offset}px)` }}>
            {windowed.slice.map(renderRow)}
          </div>
        </div>
      </div>
    </div>
  );
}
