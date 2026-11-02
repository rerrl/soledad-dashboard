This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Development Mode

```bash
yarn install
yarn dev
```

## Docker (Local Production)

```bash
docker build -t soledad-dashboard .
docker run -p 3000:3000 soledad-dashboard
```

In both cases, the app will be served at [http://localhost:3000](http://localhost:3000).

## Database

The app uses SQLite via knex.js. The database file lives at `./data/lotops.db` (gitignored).

```bash
# Run all pending migrations
yarn migrate

# Roll back the last batch of migrations
yarn migrate:rollback

# Populate with ~23 sample vehicles for development
yarn seed

# Full reset
rm -rf data && yarn migrate && yarn seed
```

## Authentication & access

The app is a private lot network behind a lightweight, home-grown login: no auth
library, no user database, no OAuth. The whole model is a handful of small files —
`src/lib/users.ts` (accounts and roles), `src/lib/auth.ts` (the session token), and
the gating middleware/proxy file (page-level redirects).

### How login works

- **Accounts are hardcoded** in `src/lib/users.ts` as `{ email, password, role }`
  entries. Email matching is case-insensitive; the password must match exactly.
- **`POST /api/auth/login`** verifies the credentials. On success it returns
  `{"ok":true,"redirect":"<home path>"}` and sets an **httpOnly** cookie named
  `soledad_session`.
- **The cookie is a signed token**, not a server-side session: its value is
  `<base64url(payload)>.<base64url(hmac)>`, where the payload is JSON
  `{ role, exp }` signed with **HMAC-SHA256** using `SESSION_SECRET` in
  `src/lib/auth.ts`. Expiry is **30 days** (`SESSION_MAX_AGE`). Cookie flags are
  `httpOnly`, `sameSite=lax`, `path=/`, and `secure` only when
  `NODE_ENV === "production"`.
- **Tampering is treated as logged out.** On every page request the gating
  middleware/proxy re-verifies the signature and the `exp` claim; a malformed,
  altered, or expired token returns no session and the user is redirected to
  `/login`.
- **Logout** (`POST` or `GET /api/auth/logout`) clears the cookie and returns to
  `/login`.
- **Browser "save password" is orthogonal.** It is plain form autofill — it has
  nothing to do with the session cookie or how long a login lasts.

Default credentials (placeholders — see below):

| Email | Default password | Role |
| --- | --- | --- |
| `admin@soledadautosales.local` | `change-me-admin` | `admin` |
| `sales@soledadautosales.local` | `change-me-sales` | `salesman` |

### Roles & gating

- **`admin`** reaches everything and lands on `/`.
- **`salesman`** lands on `/dashboard`; every other page redirects back to
  `/dashboard`.
- Gating is **page-level only**. **API routes (`/api/*`) are deliberately
  unauthenticated** — the app assumes it only runs on the trusted private lot
  network for non-technical users. This is a known, accepted limitation: anything
  that can reach the host can call the data and PDF endpoints directly.

### Before deploying / relying on this

- **Change the placeholder passwords** in `src/lib/users.ts`.
- **Set `SESSION_SECRET`** in `src/lib/auth.ts` to a long random string. Until it
  is changed, anyone with the source can forge a valid admin session.

Both values are committed to the repo as visible placeholders — treat them as
such, not as secrets.

### Future hardening ideas (not done, by design)

- Authenticate `/api/*` (per-route session/role checks) before any non-private use.
- Move users to a DB table with hashed passwords (bcrypt/argon2) and per-user
  accounts instead of a hardcoded array.
- Move `SESSION_SECRET` to an environment variable and fail startup if unset.
- Add login rate limiting / lockout.
- Record per-user attribution on mutations.
- Put the app behind HTTPS if the network ever extends beyond the trusted LAN.
- Use shorter sessions and re-authenticate for admin actions.
