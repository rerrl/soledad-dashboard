"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ChangeLogView from "./components/ChangeLogView";
import DeskManagerSyncView from "./components/DeskManagerSyncView";
import type { VehicleStatus } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

type VehicleSummary = {
  id: number;
  vin: string;
  stock_number: string | null;
  make: string;
  model: string;
  year: number;
  color: string | null;
  series: string | null;
  mileage: number | null;
  total_cost: number | null;
  selling_price: number | null;
  internet_price: number | null;
  status: VehicleStatus;
  smog_done: number;
  detail_done: number;
  inspected_done: number;
  pics_taken: number;
  dom: number;
};

type PipelineColumn = {
  incoming: VehicleSummary[];
  recon: VehicleSummary[];
  parked: VehicleSummary[];
  for_sale: VehicleSummary[];
  holding: VehicleSummary[];
  sold: VehicleSummary[];
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
  vehicle_id: number;
  stock_number: string | null;
  make: string;
  model: string;
  year: number;
  severity: "warning" | "critical";
  detail: string;
};

type ChecklistItem = {
  id: number;
  label: string;
  done: number;
  done_at: string | null;
  sort_order: number;
};

// ── Fetch helpers ────────────────────────────────────────────────────────────

const API = (path: string) => path;

const fetchJSON = (url: string) => fetch(url).then((r) => r.json());

// ── Constants ────────────────────────────────────────────────────────────────

const STATUSES: VehicleStatus[] = [
  "incoming",
  "recon",
  "parked",
  "for_sale",
  "not_for_sale",
  "sold",
];

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

const statusColor = (s: VehicleStatus) => {
  switch (s) {
    case "for_sale":
      return "#22c55e";
    case "recon":
      return "#3b82f6";
    case "parked":
      return "#ef4444";
    case "incoming":
      return "#64748b";
    default:
      return "#64748b";
  }
};

const queueGroupLabel: Record<string, string> = {
  open_tasks: "Open Tasks",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [selectedVin, setSelectedVin] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "change-log" | "deskmanager-sync">("dashboard");
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffData, setDiffData] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (selectedVin) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedVin]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const statsQuery = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => fetchJSON(API("/api/dashboard/stats")),
  });

  const pipelineQuery = useQuery<PipelineColumn>({
    queryKey: ["pipeline"],
    queryFn: () => fetchJSON(API("/api/dashboard/pipeline")),
  });

  const vehiclesQuery = useQuery<VehicleSummary[]>({
    queryKey: ["vehicles-summary"],
    queryFn: () => fetchJSON(API("/api/vehicles/summary")),
  });

  const queueQuery = useQuery<{ items: QueueItem[] }>({
    queryKey: ["queue"],
    queryFn: () => fetchJSON(API("/api/dashboard/queue")),
  });

  const checklistQuery = useQuery<ChecklistItem[]>({
    queryKey: ["checklist", selectedVin],
    queryFn: () => fetchJSON(API(`/api/vehicles/${selectedVin}/checklist`)),
    enabled: !!selectedVin,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const toggleDotMutation = useMutation({
    mutationFn: ({
      vin,
      field,
      value,
    }: {
      vin: string;
      field: string;
      value: number;
    }) =>
      fetch(API(`/api/vehicles/${vin}/dots`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles-summary"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: ({
      vin,
      id,
      done,
    }: {
      vin: string;
      id: number;
      done: number;
    }) =>
      fetch(API(`/api/vehicles/${vin}/checklist`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done }),
      }),
    onMutate: async ({ id, done }) => {
      // Optimistic update: set done_at immediately
      await queryClient.cancelQueries({ queryKey: ["checklist", selectedVin] });
      const previous = queryClient.getQueryData<ChecklistItem[]>([
        "checklist",
        selectedVin,
      ]);
      if (previous) {
        queryClient.setQueryData<ChecklistItem[]>(["checklist", selectedVin], (old) =>
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
        queryClient.setQueryData(["checklist", selectedVin], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist", selectedVin] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: ({ vin, status }: { vin: string; status: VehicleStatus }) =>
      fetch(API(`/api/vehicles/${vin}/status`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles-summary"] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: ({ vin, label }: { vin: string; label: string }) =>
      fetch(API(`/api/vehicles/${vin}/checklist`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      }),
    onSuccess: () => {
      if (selectedVin) {
        queryClient.invalidateQueries({ queryKey: ["checklist", selectedVin] });
      }
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const deleteChecklistItemMutation = useMutation({
    mutationFn: ({ vin, id }: { vin: string; id: number }) =>
      fetch(API(`/api/vehicles/${vin}/checklist`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      if (selectedVin) {
        queryClient.invalidateQueries({ queryKey: ["checklist", selectedVin] });
      }
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: ({ vin }: { vin: string }) =>
      fetch(API(`/api/vehicles/${vin}`), { method: "DELETE" }),
    onSuccess: () => {
      setSelectedVin(null);
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles-summary"] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  // ── Event handlers ─────────────────────────────────────────────────────────

  const handleToggleDot = (vin: string, field: "smog_done" | "detail_done" | "inspected_done" | "pics_taken", current: number) => {
    const newVal = current ? 0 : 1;
    // Optimistic: update vehicles + pipeline locally
    queryClient.setQueryData<VehicleSummary[]>(["vehicles-summary"], (old) =>
      old?.map((v) => (v.vin === vin ? { ...v, [field]: newVal as 0 | 1 } : v)) ?? []
    );
    queryClient.setQueryData<PipelineColumn>(["pipeline"], (oldP) => {
      if (!oldP) return oldP;
      const updateCol = (col: VehicleSummary[]) =>
        col.map((v) => (v.vin === vin ? { ...v, [field]: newVal as 0 | 1 } : v));
      return {
        ...oldP,
        incoming: updateCol(oldP.incoming),
        recon: updateCol(oldP.recon),
        parked: updateCol(oldP.parked),
        for_sale: updateCol(oldP.for_sale),
        holding: updateCol(oldP.holding),
        sold: updateCol(oldP.sold),
      };
    });
    toggleDotMutation.mutate({ vin, field, value: newVal });
  };

  const handleToggleChecklist = (id: number, done: number) => {
    if (!selectedVin) return;
    const newDone = done ? 0 : 1;
    toggleChecklistMutation.mutate({ vin: selectedVin, id, done: newDone });
  };

  const handleAddTask = () => {
    if (!newTask.trim() || !selectedVin) return;
    addTaskMutation.mutate({ vin: selectedVin, label: newTask.trim() });
    setNewTask("");
  };

  const handleChangeStatus = (vin: string, status: VehicleStatus) => {
    changeStatusMutation.mutate({ vin, status });
  };

  const handleDeleteTask = (id: number) => {
    if (!selectedVin) return;
    deleteChecklistItemMutation.mutate({ vin: selectedVin, id });
  };

  const handleDeleteVehicle = () => {
    if (!selectedVehicle) return;
    if (!confirm("Delete this vehicle permanently?")) return;
    deleteVehicleMutation.mutate({ vin: selectedVehicle.vin });
  };

  // ── CSV Import handlers ────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const text = await file.text();
      setCsvText(text);
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
      setDiffData(data);
      setShowDiffModal(true);
    } catch (err: any) {
      setImportError(`Failed to read file: ${err.message}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleApplyImport = async () => {
    if (!csvText) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/vehicles/import?apply=true", {
        method: "POST",
        body: csvText,
        headers: { "Content-Type": "text/plain" },
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Apply failed");
        return;
      }
      setShowDiffModal(false);
      setDiffData(null);
      setCsvText(null);
      // Refresh dashboard data
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles-summary"] });
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      queryClient.invalidateQueries({ queryKey: ["change-log"] });
    } catch (err: any) {
      setImportError(`Apply failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const allVehicles = vehiclesQuery.data ?? [];
  const pipeline = pipelineQuery.data ?? null;
  const stats = statsQuery.data ?? null;
  const queue = queueQuery.data?.items ?? [];
  const checklist = checklistQuery.data ?? [];
  const isLoading = statsQuery.isLoading || pipelineQuery.isLoading || vehiclesQuery.isLoading;
  const selectedVehicle = allVehicles.find((v) => v.vin === selectedVin);

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
            <button
              onClick={() => setActiveTab("deskmanager-sync")}
              className={`text-sm pb-1 border-b-2 transition-colors ${
                activeTab === "deskmanager-sync"
                  ? "text-[var(--sol-accent)] border-[var(--sol-accent)] font-medium"
                  : "text-[var(--sol-muted)] border-transparent hover:text-[var(--sol-text)]"
              }`}
            >
              DeskManager Sync
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
        className={`p-4 lg:p-6 ${selectedVin ? 'overflow-hidden' : ''}`}
      >
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
          placeholder="Search by make, model, year, VIN, or stock #..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-3 py-2 rounded text-sm border-none outline-none bg-[var(--sol-card)] text-[var(--sol-text)] placeholder-[var(--sol-dim)]"
        />
      </div>

      {/* Pipeline Swimlane */}
      <div className={`flex gap-3 ${selectedVin ? 'overflow-x-hidden pointer-events-none' : 'overflow-x-auto'} no-scrollbar pb-4 mb-6`} style={{ minHeight: "200px" }}>
        {PIPELINE_COLS.map(({ key, label }) => {
          const columnVehicles = (pipeline as any)?.[key] ?? [];
          const vehicles = searchQuery.trim()
            ? columnVehicles.filter((v: VehicleSummary) => {
                const q = searchQuery.toLowerCase();
                return (
                  v.make?.toLowerCase().includes(q) ||
                  v.model?.toLowerCase().includes(q) ||
                  String(v.year).includes(q) ||
                  v.vin?.toLowerCase().includes(q) ||
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
                {vehicles.map((v: VehicleSummary) => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    selected={selectedVin === v.vin}
                    onClick={() => setSelectedVin(v.vin === selectedVin ? null : v.vin)}
                    onDotToggle={(field) => handleToggleDot(v.vin, field, (v as any)[field] ?? 0)}
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
                  key={`${item.vehicle_id}-${i}`}
                  className="flex items-center gap-3 px-3 py-1.5 rounded cursor-pointer text-sm hover:opacity-80 transition-opacity mb-1"
                  style={{
                    backgroundColor: "var(--sol-bg)",
                    borderLeft: `3px solid ${item.severity === "critical" ? "#ef4444" : "#eab308"}`,
                  }}
                  onClick={() => {
                    const v = allVehicles.find((x) => x.id === item.vehicle_id);
                    if (v) setSelectedVin(v.vin);
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
      {selectedVehicle && (
        <div
          className="fixed inset-0 z-50 flex justify-end transition-all duration-300 ease-in-out bg-black/50"
          style={{
            pointerEvents: selectedVehicle ? "auto" : "none",
          }}
          onClick={() => setSelectedVin(null)}
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
            <div className="flex justify-end items-center gap-2 mb-4">
              <button
                onClick={handleDeleteVehicle}
                className="text-xs px-2 py-1 rounded bg-red-900/40 text-[var(--sol-red)] border border-[var(--sol-red)] hover:bg-red-800/60"
              >
                Delete Vehicle
              </button>
              <button
                onClick={() => setSelectedVin(null)}
                className="hover:text-white text-2xl leading-none text-[var(--sol-muted)]"
              >
                ✕
              </button>
            </div>

            {/* Vehicle identity */}
            <h2 className="text-xl font-bold mb-1 text-[var(--sol-accent)]">
              {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
            </h2>
            <p className="text-sm mb-4 text-[var(--sol-muted)]">
              Stock #{selectedVehicle.stock_number ?? "—"} · {selectedVehicle.vin}
            </p>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <Detail label="Color" value={selectedVehicle.color ?? "—"} />
              <Detail label="Mileage" value={selectedVehicle.mileage != null ? `${selectedVehicle.mileage.toLocaleString()}` : "—"} />
              <Detail label="Series" value={selectedVehicle.series ?? "—"} />
              <Detail label="DOM" value={`${selectedVehicle.dom}d`} />
              <Detail label="Total Cost" value={fmtCurrency(selectedVehicle.total_cost)} />
              <Detail label="Selling Price" value={fmtCurrency(selectedVehicle.selling_price)} />
              <Detail label="Internet Price" value={fmtCurrency(selectedVehicle.internet_price)} />
            </div>

            {/* Margin + discount */}
            {selectedVehicle.total_cost != null && selectedVehicle.selling_price != null && (
              <p className="text-sm mb-4 text-[var(--sol-green)]">
                Margin: {fmtCurrency(selectedVehicle.selling_price - selectedVehicle.total_cost)}
                {selectedVehicle.internet_price != null &&
                  ` · Internet discount: ${fmtCurrency(selectedVehicle.selling_price - selectedVehicle.internet_price)}`}
              </p>
            )}

            {/* Status */}
            <div className="mb-4">
              <label className="text-xs font-medium block mb-1 text-[var(--sol-muted)]">
                Status
              </label>
              <select
                value={selectedVehicle.status}
                onChange={(e) => handleChangeStatus(selectedVehicle.vin, e.target.value as VehicleStatus)}
                className="w-full rounded px-3 py-1.5 text-sm border-none cursor-pointer bg-[var(--sol-bg)] text-[var(--sol-text)]"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* S / D / I / Pics / FBM */}
            <div className="mb-4">
              <label className="text-xs font-medium block mb-1 text-[var(--sol-muted)]">
                S / D / I
              </label>
              <div className="flex gap-4 mb-2">
                <DotButton
                  label="Smog"
                  done={selectedVehicle.smog_done}
                  onClick={() => handleToggleDot(selectedVehicle.vin, "smog_done", selectedVehicle.smog_done)}
                />
                <DotButton
                  label="Detail"
                  done={selectedVehicle.detail_done}
                  onClick={() => handleToggleDot(selectedVehicle.vin, "detail_done", selectedVehicle.detail_done)}
                />
                <DotButton
                  label="Inspected"
                  done={selectedVehicle.inspected_done}
                  onClick={() => handleToggleDot(selectedVehicle.vin, "inspected_done", selectedVehicle.inspected_done)}
                />
              </div>
            <div className="flex gap-4">
                <DotButton
                  label={<><i className="fa-regular fa-camera"></i> Pics</>}
                  done={selectedVehicle.pics_taken}
                  onClick={() => handleToggleDot(selectedVehicle.vin, "pics_taken", selectedVehicle.pics_taken)}
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
      ) : activeTab === "change-log" ? (
        <ChangeLogView />
      ) : activeTab === "deskmanager-sync" ? (
        <DeskManagerSyncView />
      ) : null}

      {/* ── Diff Modal ── */}
      {showDiffModal && diffData && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/60"
          onClick={() => { setShowDiffModal(false); setCsvText(null); }}
        >
          <div
            className="w-full max-w-2xl rounded-lg p-6 shadow-2xl bg-[var(--sol-card)] text-[var(--sol-text)] border border-[var(--sol-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Import Preview</h2>
              <button
                onClick={() => { setShowDiffModal(false); setCsvText(null); }}
                className="hover:text-white text-xl leading-none text-[var(--sol-muted)]"
              >
                ✕
              </button>
            </div>

            {/* Summary bar */}
            <div className="flex gap-3 mb-4">
              {diffData.summary.added > 0 && (
                <span className="text-xs px-2 py-1 rounded bg-blue-900/40 text-blue-400">
                  {diffData.summary.added} added
                </span>
              )}
              {diffData.summary.updated > 0 && (
                <span className="text-xs px-2 py-1 rounded bg-green-900/40 text-green-400">
                  {diffData.summary.updated} updated
                </span>
              )}
              {diffData.summary.flagged > 0 && (
                <span className="text-xs px-2 py-1 rounded bg-yellow-900/40 text-yellow-400">
                  {diffData.summary.flagged} flagged
                </span>
              )}
              {diffData.summary.removed > 0 && (
                <span className="text-xs px-2 py-1 rounded bg-red-900/40 text-red-400">
                  {diffData.summary.removed} removed (sold)
                </span>
              )}
              {!diffData.diff.has_changes && (
                <span className="text-xs px-2 py-1 rounded text-[var(--sol-muted)]">
                  No changes detected
                </span>
              )}
            </div>

            {/* Diff details */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar">
              {diffData.diff.added.map((item: any, i: number) => (
                <div key={`added-${i}`} className="rounded px-3 py-2 bg-blue-900/20 border-l-2 border-l-blue-500">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-400">✦ NEW</span>
                    <span className="text-sm font-medium">{item.stock_number}</span>
                    <span className="text-xs text-[var(--sol-muted)]">{item.year} {item.make} {item.model}</span>
                  </div>
                  <p className="text-xs text-[var(--sol-dim)] mt-1">Will be added to Incoming swimlane</p>
                </div>
              ))}

              {diffData.diff.updated.map((item: any, i: number) => (
                <div key={`updated-${i}`} className="rounded px-3 py-2 bg-green-900/20 border-l-2 border-l-green-500">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-green-400">CHANGED</span>
                    <span className="text-sm font-medium">{item.stock_number}</span>
                    <span className="text-xs text-[var(--sol-muted)]">{item.year} {item.make} {item.model}</span>
                  </div>
                  {item.changes.map((ch: any, j: number) => (
                    <div key={j} className="text-xs text-[var(--sol-dim)] ml-6">
                      <span className="text-[var(--sol-muted)]">{ch.field}</span>:{" "}
                      <span className="line-through text-[var(--sol-muted)]">{ch.old_value ?? "—"}</span>
                      {" → "}
                      <span className="text-[var(--sol-green)]">{ch.new_value ?? "—"}</span>
                    </div>
                  ))}
                </div>
              ))}

            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowDiffModal(false); setCsvText(null); }}
                className="text-xs px-3 py-1.5 rounded bg-[var(--sol-surface)] hover:bg-[var(--sol-border)] text-[var(--sol-text)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyImport}
                disabled={isImporting || !diffData.diff.has_changes}
                className="text-xs px-3 py-1.5 rounded font-medium transition-opacity hover:opacity-90 disabled:opacity-50 bg-[var(--sol-accent)] text-white"
              >
                {isImporting ? "Applying..." : "Apply Import"}
              </button>
            </div>
          </div>
        </div>
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
  onDotToggle,
}: {
  vehicle: VehicleSummary;
  selected: boolean;
  onClick: () => void;
  onDotToggle: (field: "smog_done" | "detail_done" | "inspected_done" | "pics_taken") => void;
}) {
  return (
    <div
      className="rounded px-2.5 py-2 cursor-pointer transition-all text-sm"
      style={{
        backgroundColor: selected ? "#1e293b" : "var(--sol-bg)",
        borderLeft: `3px solid ${statusColor(vehicle.status)}`,
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
        {vehicle.make} {vehicle.model}
      </p>
      <p className="text-xs truncate mb-1 text-[var(--sol-muted)]">
        {vehicle.year} · {vehicle.color ?? "—"}
      </p>
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <Dot
          label="S"
          done={vehicle.smog_done}
          onClick={() => onDotToggle("smog_done")}
        />
        <Dot
          label="D"
          done={vehicle.detail_done}
          onClick={() => onDotToggle("detail_done")}
        />
        <Dot
          label="I"
          done={vehicle.inspected_done}
          onClick={() => onDotToggle("inspected_done")}
        />
        <Dot
          label="P"
          done={vehicle.pics_taken ?? 0}
          onClick={() => onDotToggle("pics_taken")}
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
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs px-1 rounded transition-opacity hover:opacity-80"
      style={{ color: done ? "#22c55e" : "#ef4444" }}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: done ? "#22c55e" : "#ef4444" }}
      />
      {label}
    </button>
  );
}

function DotButton({
  label,
  done,
  onClick,
}: {
  label: React.ReactNode;
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