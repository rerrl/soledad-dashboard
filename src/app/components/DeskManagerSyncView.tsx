"use client";

import { useState, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SyncMismatch {
  stock_number: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  app_status: string | null;
  dm_mapped_status: string | null;
  app_smog: number | null;
  dm_smog: number | null;
  app_detail: number | null;
  dm_detail: number | null;
  app_inspected: number | null;
  dm_inspected: number | null;
  diff_fields: string[];
  snapped_at: string;
}

interface SyncResponse {
  mismatches: SyncMismatch[];
  total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCheck = (val: number | null | string | undefined) => {
  const n = val == null ? null : Number(val);
  if (n === 1) return "✓";
  if (n === 0) return "✗";
  return "—";
};

const fmtStatus = (s: string | null) => {
  if (!s) return "—";
  return s;
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const mismatchBg = {
  backgroundColor: "rgba(232,90,90,0.15)",
};

// ── Cell components ──────────────────────────────────────────────────────────

function StatusCell({
  app,
  dm,
  hasDiff,
}: {
  app: string | null;
  dm: string | null;
  hasDiff: boolean;
}) {
  return (
    <div
      className={`px-2 py-1.5 rounded text-xs font-mono ${hasDiff ? "" : ""}`}
      style={hasDiff ? mismatchBg : undefined}
    >
      <div className="flex items-center gap-1">
        {hasDiff && <span>⚠</span>}
        <span>{fmtStatus(app)}</span>
        <span className="text-[var(--sol-dim)]">&rarr;</span>
        <span>{fmtStatus(dm)}</span>
      </div>
    </div>
  );
}

function CheckCell({
  app,
  dm,
  hasDiff,
}: {
  app: number | null;
  dm: number | null;
  hasDiff: boolean;
}) {
  return (
    <div
      className={`px-2 py-1.5 rounded text-xs font-mono`}
      style={hasDiff ? mismatchBg : undefined}
    >
      <div className="flex items-center gap-1">
        {hasDiff && <span>⚠</span>}
        <span>{fmtCheck(app)}</span>
        <span className="text-[var(--sol-dim)]">/</span>
        <span>{fmtCheck(dm)}</span>
      </div>
    </div>
  );
}

// ── DeskManagerSyncView ──────────────────────────────────────────────────────

export default function DeskManagerSyncView() {
  const [data, setData] = useState<SyncResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/deskmanager/sync")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-[var(--sol-bg)] text-[var(--sol-text)] min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 rounded bg-[var(--sol-skeleton)]" />
          <div className="rounded-lg border border-[var(--sol-border)] bg-[var(--sol-card)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--sol-surface)]/80">
                  {[...Array(6)].map((_, i) => (
                    <th key={i} className="px-3 py-2">
                      <div className="h-4 w-16 rounded bg-[var(--sol-skeleton)]" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--sol-border)]">
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-3 py-2">
                        <div className="h-4 w-24 rounded bg-[var(--sol-skeleton)]" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Error card ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-4 lg:p-6 bg-[var(--sol-bg)] text-[var(--sol-text)] min-h-screen">
        <div className="rounded-lg p-4 bg-[var(--sol-card)] border border-[var(--sol-red)]">
          <p className="text-[var(--sol-red)]">
            Failed to load DeskManager sync: {error}
          </p>
        </div>
      </div>
    );
  }

  const mismatches = data?.mismatches ?? [];

  // ── All synced ───────────────────────────────────────────────────────────

  if (mismatches.length === 0) {
    return (
      <div className="p-4 lg:p-6 bg-[var(--sol-bg)] text-[var(--sol-text)] min-h-screen">
        <div className="rounded-lg p-8 bg-[var(--sol-card)] border border-[var(--sol-border)] text-center">
          <p className="text-lg mb-2" style={{ color: "var(--sol-green)" }}>
            ✓ All vehicles synced
          </p>
          <p className="text-sm text-[var(--sol-dim)]">
            App values match the latest DeskManager snapshot.
          </p>
        </div>
      </div>
    );
  }

  // ── Mismatches table ─────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 bg-[var(--sol-bg)] text-[var(--sol-text)] min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold">DeskManager Sync</h2>
        <span
          className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: "rgba(232,90,90,0.2)",
            color: "var(--sol-red)",
          }}
        >
          {mismatches.length} mismatch{mismatches.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[var(--sol-border)] bg-[var(--sol-card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--sol-surface)]/80 border-b border-[var(--sol-border)]">
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--sol-muted)] uppercase tracking-wider">
                Stock#
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--sol-muted)] uppercase tracking-wider">
                Make / Model
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--sol-muted)] uppercase tracking-wider">
                Status (app &rarr; dm)
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--sol-muted)] uppercase tracking-wider">
                Smog (app / dm)
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--sol-muted)] uppercase tracking-wider">
                Detail (app / dm)
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--sol-muted)] uppercase tracking-wider">
                Inspected (app / dm)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--sol-border)]">
            {mismatches.map((m) => (
              <tr
                key={m.stock_number}
                className="hover:bg-[var(--sol-surface)]/40 transition-colors"
              >
                <td className="px-3 py-2 font-mono text-xs">
                  #{m.stock_number}
                </td>
                <td className="px-3 py-2">
                  <div className="text-xs">
                    <span className="text-[var(--sol-dim)]">{m.year}</span>{" "}
                    <span className="text-[var(--sol-text)]">
                      {m.make} {m.model}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <StatusCell
                    app={m.app_status}
                    dm={m.dm_mapped_status}
                    hasDiff={m.diff_fields.includes("status")}
                  />
                </td>
                <td className="px-3 py-2">
                  <CheckCell
                    app={m.app_smog}
                    dm={m.dm_smog}
                    hasDiff={m.diff_fields.includes("smog")}
                  />
                </td>
                <td className="px-3 py-2">
                  <CheckCell
                    app={m.app_detail}
                    dm={m.dm_detail}
                    hasDiff={m.diff_fields.includes("detail")}
                  />
                </td>
                <td className="px-3 py-2">
                  <CheckCell
                    app={m.app_inspected}
                    dm={m.dm_inspected}
                    hasDiff={m.diff_fields.includes("inspected")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-2 text-xs text-[var(--sol-dim)]">
        Last DM snapshot:{" "}
        {mismatches.length > 0 && fmtTime(mismatches[0].snapped_at)}
      </div>
    </div>
  );
}
