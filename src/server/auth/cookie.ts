import { createHash, randomBytes } from "node:crypto";

/** Raw token cookie. The database stores `hashSessionToken(token)`. */
export const SESSION_COOKIE = "engineer_session";

export const SESSION_DAYS = 30;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function sessionExpiresAt(now = Date.now()): Date {
  return new Date(now + SESSION_MAX_AGE_SECONDS * 1000);
}

export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      const value = rest.join("=").trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

export function sessionCookieHeader(token: string, expires: Date): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Expires=${expires.toUTCString()}`,
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ].join("; ");
}

export function clearSessionCookieHeader(): string {
  return [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}
