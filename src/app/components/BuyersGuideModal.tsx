"use client";

import { useEffect, useState } from "react";

/**
 * The "Service Contract?" prompt shown before a Buyers Guide is printed.
 *
 * Shared by the dashboard's vehicle panel and the salesmen library (`/dashboard`)
 * so both ask the same question and open the same PDF endpoint:
 * `/api/vehicles/<stock>/buyers-guide?serviceContract=true|false` in a new tab.
 *
 * The choice defaults to Yes on every open — the caller mounts a fresh instance
 * per open (it renders only while a stock is selected), so the local state
 * always starts at Yes. Dismiss with Escape, a click on the scrim, the ✕ or
 * Cancel; only Print opens the tab, and it closes the modal behind it.
 */
export default function BuyersGuideModal({
  stock,
  onClose,
}: {
  stock: string;
  onClose: () => void;
}) {
  const [serviceContract, setServiceContract] = useState(true);

  // Escape dismisses the modal.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Click-outside dismisses, but only for the scrim itself: a click that lands
  // inside the dialog (selecting a radio, pressing Cancel/Print) must not close
  // it.
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-bg-modal-dialog]")) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [onClose]);

  const confirm = () => {
    const url = `/api/vehicles/${stock}/buyers-guide?serviceContract=${
      serviceContract ? "true" : "false"
    }`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div
      data-bg-modal
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="presentation"
    >
      <div
        data-bg-modal-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="bg-modal-title"
        className="w-full max-w-xs rounded-lg border border-[var(--sol-border)] bg-[var(--sol-card)] text-[var(--sol-text)] shadow-2xl p-5"
      >
        <div className="flex items-start justify-between mb-3">
          <h3
            id="bg-modal-title"
            className="text-sm font-semibold text-[var(--sol-text)]"
          >
            Service Contract?
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-xl leading-none text-[var(--sol-muted)] rounded transition-colors hover:text-[var(--sol-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)]"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1 mb-5">
          {(
            [
              { value: true, label: "Yes" },
              { value: false, label: "No" },
            ] as const
          ).map((opt) => (
            <label
              key={opt.label}
              className="flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1.5 transition-colors hover:bg-[var(--sol-surface)]"
            >
              <input
                type="radio"
                name="bg-service-contract"
                checked={serviceContract === opt.value}
                onChange={() => setServiceContract(opt.value)}
                className="accent-[var(--sol-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)]"
              />
              {opt.label}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded border border-[var(--sol-border)] text-[var(--sol-muted)] transition-colors hover:text-[var(--sol-text)] hover:border-[var(--sol-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            className="text-sm px-3 py-1.5 rounded bg-[var(--sol-accent)] text-[var(--sol-bg)] font-medium transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)]"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
