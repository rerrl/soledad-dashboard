import { NextResponse, type NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth";

/**
 * Page-level gating for the private lot network.
 *
 * Deliberately NO API auth: the `matcher` below excludes every `/api/*` route,
 * so API handlers stay unauthenticated on this private network and only page
 * routes are gated here.
 *
 * Rules:
 *   - No/invalid session  → everything redirects to /login (except /login itself)
 *   - `salesman`          → only /dashboard is reachable; everything else → /dashboard
 *   - `admin`             → everything; `/` stays on the dashboard as today
 *   - After login: admin → /, salesman → /dashboard  (see homePathForRole)
 *
 * The old `/guides` path is kept as a redirect shim (src/app/guides/page.tsx)
 * for already-bookmarked URLs.
 *
 * NOTE: Next.js 16 deprecated the `middleware` file convention in favour of
 * `proxy` (same behaviour, different filename/export name). This file keeps the
 * `middleware` name the task asked for; renaming it to `src/proxy.ts` with a
 * `proxy` export opts into the new convention.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    // Unauthenticated: the login page is the only reachable page.
    if (pathname === "/login") {
      return NextResponse.next();
    }
    return redirectTo(request, "/login");
  }

  if (session.role === "salesman") {
    // Salesmen may only see /dashboard.
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      return NextResponse.next();
    }
    return redirectTo(request, "/dashboard");
  }

  // admin: full access. Keep `/` on the dashboard; bounce them off /login.
  if (pathname === "/login") {
    return redirectTo(request, "/");
  }
  return NextResponse.next();
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Page routes only:
  //   - `api`           → no API auth at all (deliberate, private network)
  //   - `_next/static`, `_next/image`, `favicon.ico`, any dotted path (assets)
  //     → excluded so CSS/JS/images keep loading
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
