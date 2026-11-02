import type { Role } from "./users";

/**
 * Session primitives — deliberately dependency-free (Node's Web Crypto, no auth
 * library).
 *
 * The session cookie value is `<base64url(payload)>.<base64url(hmac)>` where
 * the payload is JSON `{ role, exp }` and the signature is HMAC-SHA256 over the
 * payload bytes using SESSION_SECRET. Verification checks the signature and the
 * expiry, then hands back the role. This is intentionally lightweight for a
 * private lot network.
 *
 * Web Crypto (`globalThis.crypto.subtle`) is used so the exact same code runs
 * both in the login route handler (Node runtime) and in the page-gating
 * middleware (edge runtime).
 */

/** Change this to a long random string before deploying to the lot. */
const SESSION_SECRET = "change-me-soledad-session-secret";

/** Name of the httpOnly session cookie. */
export const SESSION_COOKIE = "soledad_session";

/** Session lifetime: 30 days, in seconds (the unit `cookie.maxAge` expects). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** Verified session contents. */
export type Session = {
  role: Role;
};

type SessionPayload = {
  role: Role;
  /** Absolute expiry, epoch milliseconds. */
  exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Sign a fresh session token for the given role. */
export async function createSessionToken(role: Role, now: number = Date.now()): Promise<string> {
  const payload: SessionPayload = { role, exp: now + SESSION_MAX_AGE * 1000 };
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await importHmacKey(), encoder.encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Verify a session token. Returns the session, or `null` when the token is
 * missing, malformed, tampered with, or expired.
 */
export async function readSessionToken(
  token: string | undefined | null,
): Promise<Session | null> {
  if (!token) {
    return null;
  }

  const separator = token.lastIndexOf(".");
  if (separator <= 0 || separator === token.length - 1) {
    return null;
  }

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await importHmacKey(),
      base64UrlDecode(signature),
      encoder.encode(body),
    );
    if (!valid) {
      return null;
    }

    const payload = JSON.parse(decoder.decode(base64UrlDecode(body))) as SessionPayload;
    if (payload.role !== "admin" && payload.role !== "salesman") {
      return null;
    }
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) {
      return null;
    }
    return { role: payload.role };
  } catch {
    return null;
  }
}
