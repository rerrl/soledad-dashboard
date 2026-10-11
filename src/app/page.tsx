"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ChangeLogView from "./components/ChangeLogView";
import { SUPPLEMENT_FIELDS } from "@/lib/supplement";

// ── Types ────────────────────────────────────────────────────────────────────

type PipelineVehicle = {
  stock_number: string;
  dm_make: string | null;
  dm_model: string | null;
  dm_year: number | null;
  dm_color: string | null;
  dm_vin: string | null;
  dm_series: string | null;
  dm_mileage: number | null;
  dm_total_cost: number | null;
  dm_selling_price: number | null;
  dm_internet_price: number | null;
  dm_smog: number | null;
  dm_detail: number | null;
  dm_inspected: number | null;
  pics_taken: number;
  folder: number;
  account_center: number;
  buyers_guide: number;
  window_sticker: number;
  last_posted_at: string | null;
  dom: number;
  status: string;
};

type PipelineColumn = {
  incoming: PipelineVehicle[];
  recon: PipelineVehicle[];
  parked: PipelineVehicle[];
  for_sale: PipelineVehicle[];
  holding: PipelineVehicle[];
  needs_posting: PipelineVehicle[];
};

type Stats = {
  total: number;
  for_sale: number;
  recon: number;
  parked: number;
  aged_60_plus: number;
  avg_dom: number;
};

type QueueItem = {
  type: string;
  stock_number: string;
  make: string;
  model: string;
  year: number;
  severity: "warning" | "critical";
  detail: string;
};

type ChecklistItem = {
  id: number;
  stock_number: string;
  label: string;
  done: number;
  done_at: string | null;
  sort_order: number;
};

// ── Fetch helpers ────────────────────────────────────────────────────────────

const API = (path: string) => path;

const fetchJSON = (url: string) => fetch(url).then((r) => r.json());

// ── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_COLS = [
  { key: "incoming", label: "Incoming" },
  { key: "recon", label: "In Recon" },
  { key: "parked", label: "Parked" },
  { key: "for_sale", label: "For Sale" },
  { key: "holding", label: "Holding" },
  { key: "needs_posting", label: "Needs Posting" },
] as const;

const fmtCurrency = (n: number | null) =>
  n != null ? `$${n.toLocaleString()}` : "—";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString() : "—";

const queueGroupLabel: Record<string, string> = {
  open_tasks: "Open Tasks",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "change-log">("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [importBanner, setImportBanner] = useState<{
    added: number;
    removed: number;
    updated: number;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-toggle optimistic + pending state so each VDP button reacts the instant
  // it is clicked, independent of the (slower) server round-trip.
  const [supplementOptimistic, setSupplementOptimistic] = useState<Record<string, number>>({});
  const [supplementPending, setSupplementPending] = useState<Record<string, boolean>>({});
  const [postedPending, setPostedPending] = useState(false);
  const [optimisticPosted, setOptimisticPosted] = useState<{
    stock: string;
    value: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // The vehicle currently shown in the panel is stored when it is opened (an
  // event handler, never during render) so its content survives while the panel
  // animates closed.
  const [openedVehicle, setOpenedVehicle] = useState<PipelineVehicle | null>(null);

  // Auto-dismiss the error toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const statsQuery = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => fetchJSON(API("/api/dashboard/stats")),
  });

  const pipelineQuery = useQuery<PipelineColumn>({
    queryKey: ["pipeline"],
    queryFn: () => fetchJSON(API("/api/dashboard/pipeline")),
  });

  const queueQuery = useQuery<{ items: QueueItem[] }>({
    queryKey: ["queue"],
    queryFn: () => fetchJSON(API("/api/dashboard/queue")),
  });

  const checklistQuery = useQuery<ChecklistItem[]>({
    queryKey: ["checklist", selectedStock],
    queryFn: () => fetchJSON(API(`/api/checklist?stock_number=${selectedStock}`)),
    enabled: !!selectedStock,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const toggleChecklistMutation = useMutation({
    mutationFn: ({
      id,
      done,
    }: {
      id: number;
      done: number;
    }) =>
      fetch(API("/api/checklist"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done }),
      }),
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: ["checklist", selectedStock] });
      const previous = queryClient.getQueryData<ChecklistItem[]>([
        "checklist",
        selectedStock,
      ]);
      if (previous) {
        queryClient.setQueryData<ChecklistItem[]>(["checklist", selectedStock], (old) =>
          old?.map((item) =>
            item.id === id
              ? {
                  ...item,
                  done: done as 0 | 1,
                  done_at: done ? new Date().toISOString() : null,
                }
              : item
          ) ?? []
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["checklist", selectedStock], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist", selectedStock] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: ({ label }: { label: string }) =>
      fetch(API("/api/checklist"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_number: selectedStock, label }),
      }),
    onSuccess: () => {
      if (selectedStock) {
        queryClient.invalidateQueries({ queryKey: ["checklist", selectedStock] });
      }
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const deleteChecklistItemMutation = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      fetch(API("/api/checklist"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      if (selectedStock) {
        queryClient.invalidateQueries({ queryKey: ["checklist", selectedStock] });
      }
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  // ── Event handlers ─────────────────────────────────────────────────────────

  // Supplement toggles are handled imperatively (not via useMutation) so we can
  // track optimistic + pending state per (stock, field) rather than globally.
  const handleToggleSupplement = async (
    stock_number: string,
    field: string,
    current: number,
  ) => {
    const key = `${stock_number}:${field}`;
    // Ignore clicks while this exact toggle is still in flight — rapid
    // double-clicks can't fire two conflicting writes.
    if (supplementPending[key]) return;

    const target = current ? 0 : 1;
    setSupplementOptimistic((o) => ({ ...o, [key]: target }));
    setSupplementPending((p) => ({ ...p, [key]: true }));

    try {
      const res = await fetch(API("/api/supplement"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_number, field, value: target }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    } catch {
      // Revert the optimistic flip so we never leave a stuck/wrong value.
      setSupplementOptimistic((o) => ({ ...o, [key]: current }));
      setToast(`Couldn't update ${field.replace(/_/g, " ")} — reverted.`);
    } finally {
      setSupplementPending((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };

  const handleMarkPosted = async (stock_number: string) => {
    if (postedPending) return;
    setPostedPending(true);
    setOptimisticPosted({ stock: stock_number, value: new Date().toISOString() });
    try {
      const res = await fetch(API("/api/supplement/last-posted"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_number }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    } catch {
      setOptimisticPosted(null);
      setToast("Couldn't mark as posted — reverted.");
    } finally {
      setPostedPending(false);
    }
  };

  const supplementValue = (v: PipelineVehicle, field: string): number => {
    const val = (v as Record<string, unknown>)[field];
    return typeof val === "number" ? val : 0;
  };

  const handleToggleChecklist = (id: number, done: number) => {
    const newDone = done ? 0 : 1;
    toggleChecklistMutation.mutate({ id, done: newDone });
  };

  const handleAddTask = () => {
    if (!newTask.trim() || !selectedStock) return;
    addTaskMutation.mutate({ label: newTask.trim() });
    setNewTask("");
  };

  const handleDeleteTask = (id: number) => {
    if (!selectedStock) return;
    deleteChecklistItemMutation.mutate({ id });
  };

  // ── CSV Import handler ────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/vehicles/import", {
        method: "POST",
        body: text,
        headers: { "Content-Type": "text/plain" },
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Import failed");
        return;
      }
      setImportBanner(data.summary);
      // Refresh dashboard data
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      queryClient.invalidateQueries({ queryKey: ["change-log"] });
    } catch (err) {
      setImportError(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const pipeline = pipelineQuery.data ?? null;

  const stats = statsQuery.data ?? null;
  const queue = queueQuery.data?.items ?? [];
  const checklist = checklistQuery.data ?? [];
  const isLoading = statsQuery.isLoading || pipelineQuery.isLoading;

  // The selected vehicle is derived straight from the already-loaded pipeline
  // data (which carries every supplement column) — no extra round-trip, so the
  // panel opens instantly and stays fresh after each mutation refetch.
  const allVehicles: PipelineVehicle[] = pipeline
    ? Object.values(pipeline).flat()
    : [];
  const findVehicle = (stock: string | null) =>
    stock ? allVehicles.find((v) => v.stock_number === stock) ?? null : null;

  const liveSelected = findVehicle(selectedStock);
  const panelVehicle = liveSelected ?? openedVehicle;
  const panelStock = panelVehicle?.stock_number ?? null;
  const panelOpen = !!selectedStock;

  const postedDisplay = panelVehicle
    ? optimisticPosted && optimisticPosted.stock === panelVehicle.stock_number
      ? optimisticPosted.value
      : panelVehicle.last_posted_at
    : null;

  // Open / toggle the panel from event handlers only.
  const selectVehicle = (stock: string) => {
    setSelectedStock(stock);
    const v = findVehicle(stock);
    if (v) setOpenedVehicle(v);
  };
  const toggleVehicle = (stock: string) => {
    if (stock === selectedStock) {
      setSelectedStock(null);
    } else {
      selectVehicle(stock);
    }
  };

  // ── Panel interaction: Escape + click-outside ──────────────────────────────

  useEffect(() => {
    if (!selectedStock) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedStock(null);
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Ignore clicks inside the panel itself, and clicks on a vehicle card
      // (those switch the selection through their own handler).
      if (target.closest("[data-vdp-panel]")) return;
      if (target.closest("[data-vehicle-card]")) return;
      setSelectedStock(null);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [selectedStock]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="bg-[var(--sol-bg)] text-[var(--sol-text)] min-h-screen">
        {/* Tab bar */}
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-[var(--sol-border)] bg-[var(--sol-card)]">
          <div className="flex items-center gap-6">
            <h1 className="text-sm font-bold text-[var(--sol-accent)]">LotOps</h1>
            <div className="flex gap-4">
              <span className="text-sm font-medium text-[var(--sol-accent)] border-b-2 border-[var(--sol-accent)] pb-1">Dashboard</span>
              <span className="text-sm text-[var(--sol-muted)]">Change Log</span>
            </div>
          </div>
        </header>
        <main className="p-4 lg:p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-lg p-3 animate-pulse bg-[var(--sol-card)]">
                <div className="h-3 w-16 rounded mb-2 bg-[var(--sol-skeleton)]" />
                <div className="h-7 w-12 rounded bg-[var(--sol-skeleton)]" />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pb-4" style={{ minHeight: "200px" }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-56 rounded-lg p-3 animate-pulse bg-[var(--sol-card)]">
                <div className="h-4 w-20 rounded mb-3 bg-[var(--sol-skeleton)]" />
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="rounded px-2.5 py-4 mb-2 bg-[var(--sol-skeleton)]" />
                ))}
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-[var(--sol-bg)] text-[var(--sol-text)] min-h-screen">
      {/* Tab bar */}
      <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-[var(--sol-border)] bg-[var(--sol-card)]">
        <div className="flex items-center gap-6">
          <h1 className="text-sm font-bold text-[var(--sol-accent)]">LotOps</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`text-sm pb-1 border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)] rounded-sm ${
                activeTab === "dashboard"
                  ? "text-[var(--sol-accent)] border-[var(--sol-accent)] font-medium"
                  : "text-[var(--sol-muted)] border-transparent hover:text-[var(--sol-text)]"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("change-log")}
              className={`text-sm pb-1 border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)] rounded-sm ${
                activeTab === "change-log"
                  ? "text-[var(--sol-accent)] border-[var(--sol-accent)] font-medium"
                  : "text-[var(--sol-muted)] border-transparent hover:text-[var(--sol-text)]"
              }`}
            >
              Change Log
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => window.open("/print-inventory", "_blank")}
            className="text-xs px-3 py-1.5 rounded font-medium transition-all duration-150 hover:bg-[var(--sol-surface)] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)] bg-[var(--sol-surface)] text-[var(--sol-text)] border border-[var(--sol-border)]"
          >
            🖨 Print
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="text-xs px-3 py-1.5 rounded font-medium transition-all duration-150 hover:opacity-90 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)] disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none bg-[var(--sol-accent)] text-white"
          >
            {isImporting ? "Importing..." : "Import CSV"}
          </button>
          {importError && (
            <span className="text-xs text-[var(--sol-red)]">{importError}</span>
          )}
        </div>
      </header>

      {activeTab === "dashboard" ? (
      <main className="p-4 lg:p-6">
        {/* Import Summary Banner */}
        {importBanner && (
          <div className="mb-4 rounded-lg p-3 bg-[var(--sol-card)] border border-[var(--sol-accent)] flex items-center justify-between">
            <div className="flex gap-3">
              {importBanner.added > 0 && (
                <span className="text-xs px-2 py-1 rounded bg-blue-900/40 text-blue-400">
                  {importBanner.added} added
                </span>
              )}
              {importBanner.removed > 0 && (
                <span className="text-xs px-2 py-1 rounded bg-red-900/40 text-red-400">
                  {importBanner.removed} removed
                </span>
              )}
              {importBanner.updated > 0 && (
                <span className="text-xs px-2 py-1 rounded bg-green-900/40 text-green-400">
                  {importBanner.updated} updated
                </span>
              )}
              {importBanner.added === 0 && importBanner.removed === 0 && importBanner.updated === 0 && (
                <span className="text-xs text-[var(--sol-dim)]">No changes</span>
              )}
            </div>
            <button
              onClick={() => setImportBanner(null)}
              className="text-xs text-[var(--sol-muted)] hover:text-[var(--sol-text)]"
            >
              ✕
            </button>
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total" value={stats?.total ?? 0} />
          <StatCard label="For Sale" value={stats?.for_sale ?? 0} color="#4ade80" />
          <StatCard label="In Recon" value={stats?.recon ?? 0} color="#3b82f6" />
          <StatCard
            label="Aged 60+"
            value={stats?.aged_60_plus ?? 0}
            color={(stats?.aged_60_plus ?? 0) > 0 ? "#f87171" : "#cbd5e1"}
          />
          <StatCard label="Avg DOM" value={stats?.avg_dom ?? 0} suffix="d" />
        </div>

        {/* Search / Filter */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by make, model, year, stock #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-3 py-2 rounded text-sm border-none outline-none bg-[var(--sol-card)] text-[var(--sol-text)] placeholder-[var(--sol-dim)] focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)] transition-shadow"
          />
        </div>

        {/* Dashboard body: lane content flows/shrinks beside the inline VDP */}
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Pipeline Swimlane */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 mb-6" style={{ minHeight: "200px" }}>
              {PIPELINE_COLS.map(({ key, label }) => {
                const columnVehicles = pipeline?.[key] ?? [];
                const vehicles = searchQuery.trim()
                  ? columnVehicles.filter((v: PipelineVehicle) => {
                      const q = searchQuery.toLowerCase();
                      return (
                        v.dm_make?.toLowerCase().includes(q) ||
                        v.dm_model?.toLowerCase().includes(q) ||
                        String(v.dm_year).includes(q) ||
                        v.dm_vin?.toLowerCase().includes(q) ||
                        v.stock_number?.toLowerCase().includes(q)
                      );
                    })
                  : columnVehicles;
                return (
                  <div
                    key={key}
                    className="flex-shrink-0 w-56 rounded-lg p-3 bg-[var(--sol-card)] border border-[var(--sol-border)] transition-colors duration-200 hover:border-[var(--sol-accent)]"
                  >
                    <h3 className="text-sm font-semibold mb-2 flex items-center justify-between">
                      <span className="text-[var(--sol-accent)]">{label}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded bg-[var(--sol-bg)] text-[var(--sol-muted)]"
                      >
                        {vehicles.length}
                      </span>
                    </h3>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar">
                      {vehicles.map((v: PipelineVehicle) => (
                        <VehicleCard
                          key={v.stock_number}
                          vehicle={v}
                          selected={selectedStock === v.stock_number}
                          onClick={() => toggleVehicle(v.stock_number)}
                          onPicsToggle={() => handleToggleSupplement(v.stock_number, "pics_taken", supplementValue(v, "pics_taken"))}
                          postingHighlight={key === "needs_posting"}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Attention Queue */}
            {queue.length > 0 && (
              <div
                className="rounded-lg p-4 mb-4 bg-[var(--sol-card)] border border-[var(--sol-border)]"
              >
                <h2 className="text-lg font-semibold mb-3 text-[var(--sol-red)]">
                  ⚠ Attention Queue
                </h2>
                {Object.entries(
                  queue.reduce<Record<string, QueueItem[]>>((acc, item) => {
                    (acc[item.type] ??= []).push(item);
                    return acc;
                  }, {})
                ).map(([type, items]) => (
                  <div key={type} className="mb-3">
                    <h4 className="text-sm font-medium mb-1 text-[var(--sol-accent)]">
                      {queueGroupLabel[type] ?? type}
                    </h4>
                    {items.map((item, i) => (
                      <div
                        key={`${item.stock_number}-${i}`}
                        className="flex items-center gap-3 px-3 py-1.5 rounded cursor-pointer text-sm hover:opacity-80 transition-opacity mb-1"
                        style={{
                          backgroundColor: "var(--sol-bg)",
                          borderLeft: `3px solid ${item.severity === "critical" ? "#ef4444" : "#eab308"}`,
                        }}
                        onClick={() => {
                          selectVehicle(item.stock_number);
                        }}
                      >
                        <span className="font-medium text-xs text-[var(--sol-accent)]">
                          {item.stock_number ?? "—"}
                        </span>
                        <span>
                          {item.make} {item.model} ({item.year})
                        </span>
                        <span className="text-xs text-[var(--sol-muted)]">
                          {item.detail}
                        </span>
                        <span
                          className="ml-auto text-xs px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor:
                              item.severity === "critical" ? "rgba(127,29,29,0.4)" : "rgba(113,63,18,0.4)",
                            color: item.severity === "critical" ? "#ef4444" : "#eab308",
                          }}
                        >
                          {item.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vehicle Detail Panel — inline side panel on desktop (content
              shrinks beside it); slide-over at mobile widths. */}
          <aside
            data-vdp-panel
            aria-hidden={!panelOpen}
            className={[
              "shrink-0 overflow-hidden bg-[var(--sol-card)] border-l border-[var(--sol-border)]",
              "transition-[width,transform,opacity] duration-300 ease-in-out will-change-transform",
              // mobile: fixed slide-over
              "fixed top-0 bottom-0 right-0 z-40 w-[22rem] max-w-[92vw] shadow-2xl",
              // desktop: inline, sticky, animated width
              "md:sticky md:top-4 md:right-auto md:bottom-auto md:z-0 md:shadow-none md:max-w-none md:rounded-lg md:border-l",
              panelOpen
                ? "translate-x-0 opacity-100 md:w-[26rem]"
                : "translate-x-full opacity-0 pointer-events-none md:translate-x-0 md:opacity-100 md:w-0 md:border-transparent",
            ].join(" ")}
          >
            <div className="h-full md:h-auto w-[26rem] max-w-[92vw] md:w-[26rem] md:max-h-[calc(100vh-7rem)] overflow-y-auto p-5">
              {panelVehicle && (
                <>
                  {/* Close */}
                  <div className="flex justify-end items-center mb-4">
                    <button
                      onClick={() => setSelectedStock(null)}
                      aria-label="Close vehicle panel"
                      className="text-2xl leading-none text-[var(--sol-muted)] rounded transition-colors hover:text-[var(--sol-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)]"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Vehicle identity */}
                  <h2 className="text-xl font-bold mb-1 text-[var(--sol-accent)]">
                    {panelVehicle.dm_year} {panelVehicle.dm_make} {panelVehicle.dm_model}
                  </h2>
                  <p className="text-sm mb-4 text-[var(--sol-muted)]">
                    Stock #{panelVehicle.stock_number} · {panelVehicle.dm_vin ?? "—"}
                  </p>

                  {/* Status badge */}
                  <div className="mb-4">
                    <span className="text-xs px-2 py-1 rounded bg-[var(--sol-surface)] text-[var(--sol-muted)]">
                      Status: {panelVehicle.status}
                    </span>
                  </div>

                  {/* Social posting */}
                  <div className="mb-4">
                    <label className="text-xs font-medium block mb-1 text-[var(--sol-muted)]">
                      Social Posting
                    </label>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-sm transition-colors"
                        style={{
                          color: postedDisplay
                            ? "var(--sol-muted)"
                            : "var(--sol-red)",
                        }}
                      >
                        Last posted:{" "}
                        {postedDisplay ? fmtDate(postedDisplay) : "Never posted"}
                      </span>
                      <button
                        onClick={() => panelStock && handleMarkPosted(panelStock)}
                        disabled={postedPending}
                        aria-busy={postedPending}
                        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded font-medium transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)] disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none disabled:cursor-wait bg-[var(--sol-accent)] text-white"
                      >
                        {postedPending && <Spinner />}
                        {postedPending ? "Saving..." : "Mark Posted"}
                      </button>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <Detail label="Color" value={panelVehicle.dm_color ?? "—"} />
                    <Detail label="Mileage" value={panelVehicle.dm_mileage != null ? `${panelVehicle.dm_mileage.toLocaleString()}` : "—"} />
                    <Detail label="Series" value={panelVehicle.dm_series ?? "—"} />
                    <Detail label="DOM" value={`${panelVehicle.dom}d`} />
                    <Detail label="Total Cost" value={fmtCurrency(panelVehicle.dm_total_cost)} />
                    <Detail label="Selling Price" value={fmtCurrency(panelVehicle.dm_selling_price)} />
                    <Detail label="Internet Price" value={fmtCurrency(panelVehicle.dm_internet_price)} />
                  </div>

                  {/* Margin */}
                  {panelVehicle.dm_total_cost != null && panelVehicle.dm_selling_price != null && (
                    <p className="text-sm mb-4 text-[var(--sol-green)]">
                      Margin: {fmtCurrency(panelVehicle.dm_selling_price - panelVehicle.dm_total_cost)}
                      {panelVehicle.dm_internet_price != null &&
                        ` · Internet discount: ${fmtCurrency(panelVehicle.dm_selling_price - panelVehicle.dm_internet_price)}`}
                    </p>
                  )}

                  {/* S / D / I from DM (read-only) */}
                  <div className="mb-4">
                    <label className="text-xs font-medium block mb-1 text-[var(--sol-muted)]">
                      S / D / I (from DeskManager)
                    </label>
                    <div className="flex gap-4">
                      <span className="text-xs" style={{ color: panelVehicle.dm_smog ? "#22c55e" : "#ef4444" }}>
                        Smog: {panelVehicle.dm_smog ? "✓" : "✗"}
                      </span>
                      <span className="text-xs" style={{ color: panelVehicle.dm_detail ? "#22c55e" : "#ef4444" }}>
                        Detail: {panelVehicle.dm_detail ? "✓" : "✗"}
                      </span>
                      <span className="text-xs" style={{ color: panelVehicle.dm_inspected ? "#22c55e" : "#ef4444" }}>
                        Inspected: {panelVehicle.dm_inspected ? "✓" : "✗"}
                      </span>
                    </div>
                  </div>

                  {/* Supplement toggles */}
                  <div className="mb-4">
                    <label className="text-xs font-medium block mb-1 text-[var(--sol-muted)]">
                      Supplement
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SUPPLEMENT_FIELDS.map((f) => {
                        const key = `${panelVehicle.stock_number}:${f.dbColumn}`;
                        const done =
                          supplementOptimistic[key] ??
                          supplementValue(panelVehicle, f.dbColumn);
                        return (
                          <DotButton
                            key={f.dbColumn}
                            label={f.label}
                            done={done}
                            pending={!!supplementPending[key]}
                            onClick={() =>
                              handleToggleSupplement(panelVehicle.stock_number, f.dbColumn, done)
                            }
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="mb-4">
                    <label className="text-xs font-medium block mb-2 text-[var(--sol-muted)]">
                      Checklist
                    </label>
                    <div className="space-y-1 max-h-48 overflow-y-auto mb-2">
                      {checklist.length === 0 && (
                        <p className="text-sm text-[var(--sol-dim)]">
                          No items yet
                        </p>
                      )}
                      {checklist.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer transition-colors hover:bg-[var(--sol-surface)] bg-[var(--sol-bg)]"
                          onClick={() => handleToggleChecklist(item.id, item.done)}
                        >
                          <span
                            className="inline-flex items-center justify-center w-4 h-4 rounded text-xs transition-all duration-150"
                            style={{
                              border: item.done ? "none" : "1px solid var(--sol-dim)",
                              backgroundColor: item.done ? "#22c55e" : "transparent",
                            }}
                          >
                            {item.done ? "✓" : ""}
                          </span>
                          <span
                            style={{
                              textDecoration: item.done ? "line-through" : "none",
                              color: item.done ? "var(--sol-dim)" : "var(--sol-text)",
                            }}
                          >
                            {item.label}
                          </span>
                          {item.done_at && (
                            <span className="text-xs ml-auto text-[var(--sol-dim)]">
                              {fmtDate(item.done_at)}
                            </span>
                          )}
                          {item.done === 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteTask(item.id); }}
                              className="ml-1 text-xs text-[var(--sol-red)] hover:text-red-400"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add task..."
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                        className="flex-1 px-2 py-1 rounded text-sm border-none outline-none bg-[var(--sol-bg)] text-[var(--sol-text)] focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)]"
                      />
                      <button
                        onClick={handleAddTask}
                        className="px-3 py-1 rounded text-sm font-medium transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)] bg-[var(--sol-accent)] text-[var(--sol-bg)]"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>
      ) : (
        <ChangeLogView />
      )}

      {/* Error toast */}
      {toast && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg text-sm font-medium shadow-xl bg-[var(--sol-red)] text-white"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: number;
  color?: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg p-3 bg-[var(--sol-card)]">
      <p className="text-xs font-medium mb-1 text-[var(--sol-muted)]">
        {label}
      </p>
      <p
        className="text-2xl font-bold tabular-nums"
        style={{ color: color ?? "var(--sol-text)" }}
      >
        {value}
        {suffix && (
          <span className="text-sm font-normal ml-0.5">{suffix}</span>
        )}
      </p>
    </div>
  );
}

function VehicleCard({
  vehicle,
  selected,
  onClick,
  onPicsToggle,
  postingHighlight,
}: {
  vehicle: PipelineVehicle;
  selected: boolean;
  onClick: () => void;
  onPicsToggle: () => void;
  postingHighlight?: boolean;
}) {
  // In the Needs Posting lane, a vehicle that has never been posted is flagged
  // red; once it has a last_posted_at it renders neutral.
  const neverPosted = !!postingHighlight && vehicle.last_posted_at == null;
  return (
    <div
      data-vehicle-card
      className={`group rounded px-2.5 py-2 cursor-pointer text-sm border transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 ${
        neverPosted
          ? "border-[#ef4444] hover:border-[#ef4444]"
          : "border-transparent hover:border-[var(--sol-border)]"
      } ${selected ? "ring-1 ring-[#3b82f6]" : ""} bg-[var(--sol-bg)]`}
      style={
        selected
          ? { backgroundColor: "#1e293b" }
          : neverPosted
            ? { backgroundColor: "rgba(127,29,29,0.35)" }
            : undefined
      }
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-xs text-[var(--sol-accent)]">
          {vehicle.stock_number ?? "—"}
        </span>
        <span className="text-xs tabular-nums text-[var(--sol-muted)]">
          {vehicle.dom}d
        </span>
      </div>
      <p className="font-medium truncate text-[var(--sol-text)]">
        {vehicle.dm_make} {vehicle.dm_model}
      </p>
      <p className="text-xs truncate mb-1 text-[var(--sol-muted)]">
        {vehicle.dm_year} · {vehicle.dm_color ?? "—"}
      </p>
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <Dot
          label="S"
          done={vehicle.dm_smog ?? 0}
        />
        <Dot
          label="D"
          done={vehicle.dm_detail ?? 0}
        />
        <Dot
          label="I"
          done={vehicle.dm_inspected ?? 0}
        />
        <Dot
          label="P"
          done={vehicle.pics_taken ?? 0}
          onClick={onPicsToggle}
        />
      </div>
    </div>
  );
}

function Dot({
  label,
  done,
  onClick,
}: {
  label: string;
  done: number;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: done ? "#22c55e" : "#ef4444" }}
      />
      {label}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 text-xs px-1 rounded cursor-pointer transition-all duration-150 hover:opacity-80 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)]"
        style={{ color: done ? "#22c55e" : "#ef4444" }}
      >
        {inner}
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-1"
      style={{ color: done ? "#22c55e" : "#ef4444" }}
    >
      {inner}
    </span>
  );
}

function DotButton({
  label,
  done,
  pending,
  onClick,
}: {
  label: string;
  done: number;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
      className="flex items-center gap-2 px-3 py-1.5 rounded text-sm border transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)] disabled:cursor-wait disabled:translate-y-0 disabled:shadow-none"
      style={{
        backgroundColor: done ? "rgba(5,46,22,0.5)" : "rgba(127,29,29,0.5)",
        color: done ? "#22c55e" : "#ef4444",
        borderColor: done ? "#22c55e" : "#ef4444",
        opacity: pending ? 0.65 : 1,
      }}
    >
      {pending ? (
        <Spinner />
      ) : (
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: done ? "#22c55e" : "#ef4444" }}
        />
      )}
      {label} {pending ? "…" : done ? "✓" : "○"}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--sol-muted)]">
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
