"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ChangeLogView from "./components/ChangeLogView";

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
  dom: number;
  status: string;
};

type PipelineColumn = {
  incoming: PipelineVehicle[];
  recon: PipelineVehicle[];
  parked: PipelineVehicle[];
  for_sale: PipelineVehicle[];
  holding: PipelineVehicle[];
  sold: PipelineVehicle[];
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
  { key: "sold", label: "Sold" },
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

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (selectedStock) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedStock]);

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

  const vehicleDetailQuery = useQuery<PipelineVehicle | null>({
    queryKey: ["vehicle-detail", selectedStock],
    queryFn: async () => {
      if (!selectedStock) return null;
      const data = await fetchJSON(API("/api/dashboard/pipeline"));
      // Find the vehicle across all pipeline columns
      for (const col of Object.values(data)) {
        const v = (col as any[]).find((x: any) => x.stock_number === selectedStock);
        if (v) return v;
      }
      return null;
    },
    enabled: !!selectedStock,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const togglePicsMutation = useMutation({
    mutationFn: ({
      stock_number,
      value,
    }: {
      stock_number: string;
      value: number;
    }) =>
      fetch(API("/api/supplement/pics"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_number, value }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-detail"] });
    },
  });

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

  const handleTogglePics = (stock_number: string, current: number) => {
    const newVal = current ? 0 : 1;
    togglePicsMutation.mutate({ stock_number, value: newVal });
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
    } catch (err: any) {
      setImportError(`Failed to read file: ${err.message}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const pipeline = pipelineQuery.data ?? null;

  // Flatten all vehicles from pipeline for lookup
  const allVehicles: PipelineVehicle[] = pipeline
    ? Object.values(pipeline).flat()
    : [];

  const stats = statsQuery.data ?? null;
  const queue = queueQuery.data?.items ?? [];
  const checklist = checklistQuery.data ?? [];
  const selectedVehicle = vehicleDetailQuery.data;
  const isLoading = statsQuery.isLoading || pipelineQuery.isLoading;

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
              className={`text-sm pb-1 border-b-2 transition-colors ${
                activeTab === "dashboard"
                  ? "text-[var(--sol-accent)] border-[var(--sol-accent)] font-medium"
                  : "text-[var(--sol-muted)] border-transparent hover:text-[var(--sol-text)]"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("change-log")}
              className={`text-sm pb-1 border-b-2 transition-colors ${
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
            className="text-xs px-3 py-1.5 rounded font-medium transition-opacity hover:opacity-90 bg-[var(--sol-surface)] text-[var(--sol-text)] border border-[var(--sol-border)]"
          >
            🖨 Print
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="text-xs px-3 py-1.5 rounded font-medium transition-opacity hover:opacity-90 disabled:opacity-50 bg-[var(--sol-accent)] text-white"
          >
            {isImporting ? "Importing..." : "Import CSV"}
          </button>
          {importError && (
            <span className="text-xs text-[var(--sol-red)]">{importError}</span>
          )}
        </div>
      </header>

      {activeTab === "dashboard" ? (
      <main
        className={`p-4 lg:p-6 ${selectedStock ? 'overflow-hidden' : ''}`}
      >
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
            className="w-full max-w-md px-3 py-2 rounded text-sm border-none outline-none bg-[var(--sol-card)] text-[var(--sol-text)] placeholder-[var(--sol-dim)]"
          />
        </div>

        {/* Pipeline Swimlane */}
        <div className={`flex gap-3 ${selectedStock ? 'overflow-x-hidden pointer-events-none' : 'overflow-x-auto'} no-scrollbar pb-4 mb-6`} style={{ minHeight: "200px" }}>
          {PIPELINE_COLS.map(({ key, label }) => {
            const columnVehicles = (pipeline as any)?.[key] ?? [];
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
                className="flex-shrink-0 w-56 rounded-lg p-3 bg-[var(--sol-card)] border border-[var(--sol-border)]"
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
                      onClick={() => setSelectedStock(v.stock_number === selectedStock ? null : v.stock_number)}
                      onPicsToggle={() => handleTogglePics(v.stock_number, v.pics_taken)}
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
                      setSelectedStock(item.stock_number);
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

        {/* Vehicle Detail Panel */}
        {selectedVehicle && selectedStock && (
          <div
            className="fixed inset-0 z-50 flex justify-end transition-all duration-300 ease-in-out bg-black/50"
            style={{
              pointerEvents: selectedVehicle ? "auto" : "none",
            }}
            onClick={() => setSelectedStock(null)}
          >
            <div
              className="w-full max-w-lg h-full overflow-y-auto p-6 shadow-2xl transition-all duration-300 ease-in-out bg-[var(--sol-card)] text-[var(--sol-text)] border-l border-[var(--sol-border)]"
              style={{
                transform: selectedVehicle ? "translateX(0)" : "translateX(100%)",
                opacity: selectedVehicle ? 1 : 0,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close */}
              <div className="flex justify-end items-center mb-4">
                <button
                  onClick={() => setSelectedStock(null)}
                  className="hover:text-white text-2xl leading-none text-[var(--sol-muted)]"
                >
                  ✕
                </button>
              </div>

              {/* Vehicle identity */}
              <h2 className="text-xl font-bold mb-1 text-[var(--sol-accent)]">
                {selectedVehicle.dm_year} {selectedVehicle.dm_make} {selectedVehicle.dm_model}
              </h2>
              <p className="text-sm mb-4 text-[var(--sol-muted)]">
                Stock #{selectedVehicle.stock_number} · {selectedVehicle.dm_vin ?? "—"}
              </p>

              {/* Status badge */}
              <div className="mb-4">
                <span className="text-xs px-2 py-1 rounded bg-[var(--sol-surface)] text-[var(--sol-muted)]">
                  Status: {selectedVehicle.status}
                </span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <Detail label="Color" value={selectedVehicle.dm_color ?? "—"} />
                <Detail label="Mileage" value={selectedVehicle.dm_mileage != null ? `${selectedVehicle.dm_mileage.toLocaleString()}` : "—"} />
                <Detail label="Series" value={selectedVehicle.dm_series ?? "—"} />
                <Detail label="DOM" value={`${selectedVehicle.dom}d`} />
                <Detail label="Total Cost" value={fmtCurrency(selectedVehicle.dm_total_cost)} />
                <Detail label="Selling Price" value={fmtCurrency(selectedVehicle.dm_selling_price)} />
                <Detail label="Internet Price" value={fmtCurrency(selectedVehicle.dm_internet_price)} />
              </div>

              {/* Margin */}
              {selectedVehicle.dm_total_cost != null && selectedVehicle.dm_selling_price != null && (
                <p className="text-sm mb-4 text-[var(--sol-green)]">
                  Margin: {fmtCurrency(selectedVehicle.dm_selling_price - selectedVehicle.dm_total_cost)}
                  {selectedVehicle.dm_internet_price != null &&
                    ` · Internet discount: ${fmtCurrency(selectedVehicle.dm_selling_price - selectedVehicle.dm_internet_price)}`}
                </p>
              )}

              {/* S / D / I from DM (read-only) */}
              <div className="mb-4">
                <label className="text-xs font-medium block mb-1 text-[var(--sol-muted)]">
                  S / D / I (from DeskManager)
                </label>
                <div className="flex gap-4">
                  <span className="text-xs" style={{ color: selectedVehicle.dm_smog ? "#22c55e" : "#ef4444" }}>
                    Smog: {selectedVehicle.dm_smog ? "✓" : "✗"}
                  </span>
                  <span className="text-xs" style={{ color: selectedVehicle.dm_detail ? "#22c55e" : "#ef4444" }}>
                    Detail: {selectedVehicle.dm_detail ? "✓" : "✗"}
                  </span>
                  <span className="text-xs" style={{ color: selectedVehicle.dm_inspected ? "#22c55e" : "#ef4444" }}>
                    Inspected: {selectedVehicle.dm_inspected ? "✓" : "✗"}
                  </span>
                </div>
              </div>

              {/* Pics toggle */}
              <div className="mb-4">
                <label className="text-xs font-medium block mb-1 text-[var(--sol-muted)]">
                  Supplement
                </label>
                <div className="flex gap-4">
                  <DotButton
                    label="Pics Taken"
                    done={selectedVehicle.pics_taken}
                    onClick={() => handleTogglePics(selectedStock, selectedVehicle.pics_taken)}
                  />
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
                      className="flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer transition-colors hover:opacity-80 bg-[var(--sol-bg)]"
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
                    className="flex-1 px-2 py-1 rounded text-sm border-none outline-none bg-[var(--sol-bg)] text-[var(--sol-text)]"
                  />
                  <button
                    onClick={handleAddTask}
                    className="px-3 py-1 rounded text-sm font-medium transition-opacity hover:opacity-90 bg-[var(--sol-accent)] text-[var(--sol-bg)]"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      ) : (
        <ChangeLogView />
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

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
}: {
  vehicle: PipelineVehicle;
  selected: boolean;
  onClick: () => void;
  onPicsToggle: () => void;
}) {
  return (
    <div
      className="rounded px-2.5 py-2 cursor-pointer transition-all text-sm"
      style={{
        backgroundColor: selected ? "#1e293b" : "var(--sol-bg)",
        outline: selected ? "1px solid #3b82f6" : undefined,
      }}
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
        className="inline-flex items-center gap-1 text-xs px-1 rounded cursor-pointer transition-opacity hover:opacity-80"
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
  onClick,
}: {
  label: string;
  done: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-opacity hover:opacity-90"
      style={{
        backgroundColor: done ? "rgba(5,46,22,0.5)" : "rgba(127,29,29,0.5)",
        color: done ? "#22c55e" : "#ef4444",
        border: `1px solid ${done ? "#22c55e" : "#ef4444"}`,
      }}
    >
      <span
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: done ? "#22c55e" : "#ef4444" }}
      />
      {label} {done ? "✓" : "○"}
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