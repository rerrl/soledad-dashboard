import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

function clearSession(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

/** POST /api/auth/logout — clears the session cookie. */
export async function POST(request: NextRequest) {
  return clearSession(request);
}

/**
 * GET /api/auth/logout — lets a plain logout link work too; clears the session
 * cookie and sends the browser back to /login.
 */
export async function GET(request: NextRequest) {
  return clearSession(request);
}
