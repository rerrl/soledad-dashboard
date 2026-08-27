"use client";

import { useCallback, useEffect, useState } from "react";

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
  status: string;
  smog_done: number;
  detail_done: number;
  inspected_done: number;
  last_fb_post: string | null;
  reviewed_at: string | null;
  dom: number;
};

type PipelineColumn = {
  incoming: VehicleSummary[];
  recon: VehicleSummary[];
  parked: VehicleSummary[];
  for_sale: VehicleSummary[];
  hidden: VehicleSummary[];
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const API = (path: string) => path;

const STATUSES = [
  "incoming",
  "recon",
  "parked",
  "for_sale",
  "not_for_sale",
  "sold",
] as const;

const PIPELINE_COLS = [
  { key: "incoming", label: "Incoming" },
  { key: "recon", label: "In Recon" },
  { key: "parked", label: "Parked" },
  { key: "for_sale", label: "For Sale" },
  { key: "hidden", label: "Hidden" },
] as const;

const fmtCurrency = (n: number | null) =>
  n != null ? `$${n.toLocaleString()}` : "—";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString() : "—";

const statusColor = (s: string) => {
  switch (s) {
    case "for_sale":
      return "#3dd68c";
    case "recon":
      return "#e8a838";
    case "parked":
      return "#e85a5a";
    case "incoming":
      return "#6b7280";
    default:
      return "#6b7280";
  }
};

const queueGroupLabel: Record<string, string> = {
  stalled_in_recon: "Stalled in Recon",
  stalled_parked: "Stalled in Parked",
  aged_90_plus: "Aged 90+ Days",
  unposted_30_days: "Unposted to FB",
  open_tasks: "Open Tasks",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pipeline, setPipeline] = useState<PipelineColumn | null>(null);
  const [allVehicles, setAllVehicles] = useState<VehicleSummary[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedVin, setSelectedVin] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newTask, setNewTask] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [s, p, vs, q] = await Promise.all([
      fetch(API("/api/dashboard/stats")).then((r) => r.json()),
      fetch(API("/api/dashboard/pipeline")).then((r) => r.json()),
      fetch(API("/api/vehicles/summary")).then((r) => r.json()),
      fetch(API("/api/dashboard/queue")).then((r) => r.json()),
    ]);
    setStats(s);
    setPipeline(p);
    setAllVehicles(vs);
    setQueue(q.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Fetch checklist when a vehicle is selected
  const fetchChecklist = useCallback(async (vin: string) => {
    const items = await fetch(API(`/api/vehicles/${vin}/checklist`)).then((r) =>
      r.json()
    );
    setChecklist(items);
  }, []);

  useEffect(() => {
    if (selectedVin) {
      fetchChecklist(selectedVin);
    } else {
      setChecklist([]);
    }
  }, [selectedVin, fetchChecklist]);

  const toggleDot = async (
    vin: string,
    field: "smog_done" | "detail_done" | "inspected_done",
    current: number
  ) => {
    const newVal = current ? 0 : 1;
    // Optimistic: update local state immediately
    setAllVehicles((prev) =>
      prev.map((v) =>
        v.vin === vin ? { ...v, [field]: newVal as 0 | 1 } : v
      )
    );
    if (pipeline) {
      const updateCol = (col: VehicleSummary[]) =>
        col.map((v) => (v.vin === vin ? { ...v, [field]: newVal as 0 | 1 } : v));
      setPipeline({
        ...pipeline,
        incoming: updateCol(pipeline.incoming),
        recon: updateCol(pipeline.recon),
        parked: updateCol(pipeline.parked),
        for_sale: updateCol(pipeline.for_sale),
        hidden: updateCol(pipeline.hidden),
      });
    }
    await fetch(API(`/api/vehicles/${vin}/dots`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: newVal }),
    });
  };

  const changeStatus = async (vin: string, status: string) => {
    await fetch(API(`/api/vehicles/${vin}/status`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchAll();
  };

  const markReviewed = async (vin: string) => {
    await fetch(API(`/api/vehicles/${vin}/review`), {
      method: "PUT",
    });
    fetchAll();
    fetchChecklist(vin);
  };

  const toggleChecklist = async (id: number, done: number) => {
    const newDone = done ? 0 : 1;
    setChecklist((prev) =>
      prev.map((c) => (c.id === id ? { ...c, done: newDone as 0 | 1 } : c))
    );
    await fetch(API(`/api/vehicles/${selectedVin}/checklist`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done: newDone }),
    });
  };

  const addTask = async () => {
    if (!newTask.trim() || !selectedVin) return;
    await fetch(API(`/api/vehicles/${selectedVin}/checklist`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newTask.trim() }),
    });
    setNewTask("");
    fetchChecklist(selectedVin);
  };

  const selectedVehicle = allVehicles.find((v) => v.vin === selectedVin);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main
        style={{ backgroundColor: "#0b0e14", minHeight: "100vh", color: "#cbd5e1" }}
        className="flex items-center justify-center"
      >
        <p className="text-lg">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main
      style={{ backgroundColor: "#0b0e14", minHeight: "100vh", color: "#cbd5e1" }}
      className="min-h-screen p-4 lg:p-6"
    >
      {/* Auto-refresh button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={fetchAll}
          style={{ backgroundColor: "#131820", color: "#e8a838", border: "1px solid #e8a838" }}
          className="px-3 py-1.5 rounded text-sm hover:opacity-80 transition-opacity"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total" value={stats?.total ?? 0} />
        <StatCard label="For Sale" value={stats?.for_sale ?? 0} color="#3dd68c" />
        <StatCard label="In Recon" value={stats?.recon ?? 0} color="#e8a838" />
        <StatCard
          label="Aged 60+"
          value={stats?.aged_60_plus ?? 0}
          color={(stats?.aged_60_plus ?? 0) > 0 ? "#e85a5a" : "#cbd5e1"}
        />
        <StatCard label="Avg DOM" value={stats?.avg_dom ?? 0} suffix="d" />
      </div>

      {/* Pipeline Swimlane */}
      <div className="flex gap-3 overflow-x-auto pb-4 mb-6" style={{ minHeight: "200px" }}>
        {PIPELINE_COLS.map(({ key, label }) => {
          const vehicles = (pipeline as any)?.[key] ?? [];
          return (
            <div
              key={key}
              className="flex-shrink-0 w-56 rounded-lg p-3"
              style={{ backgroundColor: "#131820" }}
            >
              <h3 className="text-sm font-semibold mb-2 flex items-center justify-between">
                <span style={{ color: "#e8a838" }}>{label}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "#0b0e14", color: "#9ca3af" }}
                >
                  {vehicles.length}
                </span>
              </h3>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {vehicles.map((v: VehicleSummary) => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    selected={selectedVin === v.vin}
                    onClick={() => setSelectedVin(v.vin === selectedVin ? null : v.vin)}
                    onDotToggle={(field) => toggleDot(v.vin, field, v[field])}
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
          className="rounded-lg p-4 mb-4"
          style={{ backgroundColor: "#131820" }}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: "#e85a5a" }}>
            ⚠ Attention Queue
          </h2>
          {Object.entries(
            queue.reduce<Record<string, QueueItem[]>>((acc, item) => {
              (acc[item.type] ??= []).push(item);
              return acc;
            }, {})
          ).map(([type, items]) => (
            <div key={type} className="mb-3">
              <h4 className="text-sm font-medium mb-1" style={{ color: "#e8a838" }}>
                {queueGroupLabel[type] ?? type}
              </h4>
              {items.map((item, i) => (
                <div
                  key={`${item.vehicle_id}-${i}`}
                  className="flex items-center gap-3 px-3 py-1.5 rounded cursor-pointer text-sm hover:opacity-80 transition-opacity mb-1"
                  style={{
                    backgroundColor: "#0b0e14",
                    borderLeft: `3px solid ${item.severity === "critical" ? "#e85a5a" : "#e8a838"}`,
                  }}
                  onClick={() => {
                    const v = allVehicles.find((x) => x.id === item.vehicle_id);
                    if (v) setSelectedVin(v.vin);
                  }}
                >
                  <span className="font-medium" style={{ color: "#e8a838" }}>
                    {item.stock_number ?? "—"}
                  </span>
                  <span>
                    {item.make} {item.model} ({item.year})
                  </span>
                  <span className="text-xs" style={{ color: "#9ca3af" }}>
                    {item.detail}
                  </span>
                  <span
                    className="ml-auto text-xs px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor:
                        item.severity === "critical" ? "#3b1212" : "#3b2e12",
                      color: item.severity === "critical" ? "#e85a5a" : "#e8a838",
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
          className="fixed inset-0 z-50 flex justify-end"
          onClick={() => setSelectedVin(null)}
        >
          <div
            className="w-full max-w-lg h-full overflow-y-auto p-6 shadow-2xl"
            style={{ backgroundColor: "#131820", color: "#cbd5e1" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setSelectedVin(null)}
                style={{ color: "#9ca3af" }}
                className="hover:text-white text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Vehicle identity */}
            <h2 className="text-xl font-bold mb-1" style={{ color: "#e8a838" }}>
              {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
            </h2>
            <p className="text-sm mb-4" style={{ color: "#9ca3af" }}>
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

            {/* Margin + markup */}
            {selectedVehicle.total_cost != null && selectedVehicle.selling_price != null && (
              <p className="text-sm mb-4" style={{ color: "#3dd68c" }}>
                Margin: {fmtCurrency(selectedVehicle.selling_price - selectedVehicle.total_cost)}
                {selectedVehicle.internet_price != null &&
                  ` · Internet markup: ${fmtCurrency(selectedVehicle.internet_price - selectedVehicle.selling_price)}`}
              </p>
            )}

            {/* Status */}
            <div className="mb-4">
              <label className="text-xs font-medium block mb-1" style={{ color: "#9ca3af" }}>
                Status
              </label>
              <select
                value={selectedVehicle.status}
                onChange={(e) => changeStatus(selectedVehicle.vin, e.target.value)}
                className="w-full rounded px-3 py-1.5 text-sm border-none cursor-pointer"
                style={{ backgroundColor: "#0b0e14", color: "#cbd5e1" }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* S/D/I dots */}
            <div className="mb-4">
              <label className="text-xs font-medium block mb-1" style={{ color: "#9ca3af" }}>
                S / D / I
              </label>
              <div className="flex gap-4">
                <DotButton
                  label="Smog"
                  done={selectedVehicle.smog_done}
                  onClick={() => toggleDot(selectedVehicle.vin, "smog_done", selectedVehicle.smog_done)}
                />
                <DotButton
                  label="Detail"
                  done={selectedVehicle.detail_done}
                  onClick={() => toggleDot(selectedVehicle.vin, "detail_done", selectedVehicle.detail_done)}
                />
                <DotButton
                  label="Inspected"
                  done={selectedVehicle.inspected_done}
                  onClick={() => toggleDot(selectedVehicle.vin, "inspected_done", selectedVehicle.inspected_done)}
                />
              </div>
            </div>

            {/* FB Post */}
            <div className="mb-4">
              <label className="text-xs font-medium block mb-1" style={{ color: "#9ca3af" }}>
                Last FB Post
              </label>
              <p className="text-sm">{fmtDate(selectedVehicle.last_fb_post)}</p>
            </div>

            {/* Reviewed */}
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: "#9ca3af" }}>
                Reviewed: {fmtDate(selectedVehicle.reviewed_at)}
              </span>
              <button
                onClick={() => markReviewed(selectedVehicle.vin)}
                className="text-xs px-2 py-0.5 rounded ml-auto"
                style={{ backgroundColor: "#0b0e14", color: "#e8a838", border: "1px solid #e8a838" }}
              >
                Mark Reviewed
              </button>
            </div>

            {/* Checklist */}
            <div className="mb-4">
              <label className="text-xs font-medium block mb-2" style={{ color: "#9ca3af" }}>
                Checklist
              </label>
              <div className="space-y-1 max-h-48 overflow-y-auto mb-2">
                {checklist.length === 0 && (
                  <p className="text-sm" style={{ color: "#6b7280" }}>
                    No items yet
                  </p>
                )}
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer"
                    style={{ backgroundColor: "#0b0e14" }}
                    onClick={() => toggleChecklist(item.id, item.done)}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded text-xs ${
                        item.done ? "bg-green-500" : "border"
                      }`}
                      style={{
                        borderColor: item.done ? undefined : "#6b7280",
                        backgroundColor: item.done ? "#3dd68c" : "transparent",
                      }}
                    >
                      {item.done ? "✓" : ""}
                    </span>
                    <span style={{ textDecoration: item.done ? "line-through" : "none", color: item.done ? "#6b7280" : "#cbd5e1" }}>
                      {item.label}
                    </span>
                    {item.done_at && (
                      <span className="text-xs ml-auto" style={{ color: "#6b7280" }}>
                        {fmtDate(item.done_at)}
                      </span>
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
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  className="flex-1 px-2 py-1 rounded text-sm border-none"
                  style={{ backgroundColor: "#0b0e14", color: "#cbd5e1" }}
                />
                <button
                  onClick={addTask}
                  className="px-3 py-1 rounded text-sm"
                  style={{ backgroundColor: "#e8a838", color: "#0b0e14" }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
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
    <div
      className="rounded-lg p-3"
      style={{ backgroundColor: "#131820" }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: "#9ca3af" }}>
        {label}
      </p>
      <p
        className="text-2xl font-bold tabular-nums"
        style={{ color: color ?? "#cbd5e1" }}
      >
        {value}
        {suffix && <span className="text-sm font-normal ml-0.5">{suffix}</span>}
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
  onDotToggle: (field: "smog_done" | "detail_done" | "inspected_done") => void;
}) {
  return (
    <div
      className="rounded px-2.5 py-2 cursor-pointer transition-all text-sm"
      style={{
        backgroundColor: selected ? "#1e293b" : "#0b0e14",
        borderLeft: `3px solid ${statusColor(vehicle.status)}`,
        outline: selected ? "1px solid #e8a838" : undefined,
      }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-xs" style={{ color: "#e8a838" }}>
          {vehicle.stock_number ?? "—"}
        </span>
        <span className="text-xs tabular-nums" style={{ color: "#9ca3af" }}>
          {vehicle.dom}d
        </span>
      </div>
      <p className="font-medium truncate" style={{ color: "#cbd5e1" }}>
        {vehicle.make} {vehicle.model}
      </p>
      <p className="text-xs truncate mb-1" style={{ color: "#9ca3af" }}>
        {vehicle.year} · {vehicle.color ?? "—"}
      </p>
      {/* S/D/I Dots */}
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
      style={{
        color: done ? "#3dd68c" : "#e85a5a",
      }}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{
          backgroundColor: done ? "#3dd68c" : "#e85a5a",
        }}
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
  label: string;
  done: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded text-sm"
      style={{
        backgroundColor: done ? "#1a3a2a" : "#3b1212",
        color: done ? "#3dd68c" : "#e85a5a",
        border: `1px solid ${done ? "#3dd68c" : "#e85a5a"}`,
      }}
    >
      <span
        className="w-3 h-3 rounded-full"
        style={{
          backgroundColor: done ? "#3dd68c" : "#e85a5a",
        }}
      />
      {label} {done ? "✓" : "○"}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium" style={{ color: "#9ca3af" }}>
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}