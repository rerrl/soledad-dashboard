import { NextResponse, type NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { findUser, homePathForRole } from "@/lib/users";

/**
 * POST /api/auth/login — verifies credentials against the hardcoded users in
 * src/lib/users.ts and sets the signed, httpOnly session cookie (30 days).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof (body as { email?: unknown })?.email === "string"
    ? ((body as { email: string }).email)
    : "";
  const password = typeof (body as { password?: unknown })?.password === "string"
    ? ((body as { password: string }).password)
    : "";

  const user = findUser(email, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = await createSessionToken(user.role);
  const response = NextResponse.json({ ok: true, redirect: homePathForRole(user.role) });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
