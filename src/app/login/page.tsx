"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json().catch(() => null)) as
        | { redirect?: string; error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error ?? "Unable to sign in. Try again.");
        setSubmitting(false);
        return;
      }

      router.replace(data?.redirect ?? "/");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-[var(--sol-bg)] text-[var(--sol-text)]">
      <div className="w-full max-w-sm rounded-xl border border-[var(--sol-border)] bg-[var(--sol-card)] p-6 shadow-lg">
        <div className="mb-6">
          <p className="text-sm font-bold text-[var(--sol-accent)]">Soledad LotOps</p>
          <p className="mt-1 text-xs text-[var(--sol-muted)]">
            Sign in to the lot dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--sol-muted)]">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-lg border border-[var(--sol-border)] bg-[var(--sol-surface)] px-3 py-2 text-sm text-[var(--sol-text)] placeholder:text-[var(--sol-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--sol-accent)]"
              placeholder="you@soledadautosales.local"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--sol-muted)]">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-[var(--sol-border)] bg-[var(--sol-surface)] px-3 py-2 text-sm text-[var(--sol-text)] placeholder:text-[var(--sol-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--sol-accent)]"
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p role="alert" className="text-xs text-[var(--sol-red)]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-lg bg-[var(--sol-accent)] px-3 py-2 text-sm font-medium text-white transition-all duration-150 hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
