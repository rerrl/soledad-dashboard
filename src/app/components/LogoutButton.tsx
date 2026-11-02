// ─────────────────────────────────────────────────────────────────────────────
// Sign-out control shared by the admin dashboard (`/`) and the tool page
// (`/dashboard`).
//
// A plain link to the logout route: `/api/auth/logout` clears the signed
// session cookie server-side and redirects to `/login`, so this works without
// any client-side session state or JS. Styling matches the other header
// controls (subtle surface, hover lift).
// ─────────────────────────────────────────────────────────────────────────────

export default function LogoutButton() {
  return (
    <a
      href="/api/auth/logout"
      className="text-xs px-3 py-1.5 rounded font-medium transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sol-accent)] bg-[var(--sol-surface)] text-[var(--sol-muted)] border border-[var(--sol-border)] hover:text-[var(--sol-text)]"
    >
      Log out
    </a>
  );
}
