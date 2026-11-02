// ─────────────────────────────────────────────────────────────────────────────
// EDIT THESE CREDENTIALS
//
// Hardcoded users for the private lot network login (deliberately lightweight:
// no DB users, no OAuth). The passwords below are OBVIOUS PLACEHOLDERS — change
// them before this is relied on for anything real.
//
// This file is the single source of truth for accounts/roles: the login route
// authenticates against it and the page-gating middleware keys off the role
// carried in the signed session cookie.
// ─────────────────────────────────────────────────────────────────────────────

export type Role = "admin" | "salesman";

export type User = {
  email: string;
  password: string;
  role: Role;
};

export const USERS: User[] = [
  {
    email: "admin@soledadautosales.local",
    password: "change-me-admin",
    role: "admin",
  },
  {
    email: "sales@soledadautosales.local",
    password: "change-me-sales",
    role: "salesman",
  },
];

/**
 * Case-insensitive email match with an exact password match.
 * Returns the user on success, or `null` on bad credentials.
 */
export function findUser(email: string, password: string): User | null {
  const normalizedEmail = email.trim().toLowerCase();
  return (
    USERS.find(
      (user) =>
        user.email.toLowerCase() === normalizedEmail && user.password === password,
    ) ?? null
  );
}

/** Where a user lands immediately after a successful login. */
export function homePathForRole(role: Role): string {
  return role === "admin" ? "/" : "/dashboard";
}
