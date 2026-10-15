const FALLBACK = "/analyses";

/**
 * Path to open after sign-in. Only same-origin app paths are allowed.
 * Anything else, including the sign-in page, goes to the analyses list.
 */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !isAppPath(value) || isSignInPath(value)) {
    return FALLBACK;
  }
  return value;
}

/** Sign-in URL that returns the engineer to `from` when that path is safe. */
export function signInPath(from: string): string {
  return `/sign-in?next=${encodeURIComponent(safeReturnPath(from))}`;
}

/**
 * Missing-cookie redirect. Demo mode and the sign-in page stay public.
 * API routes answer with their own status codes.
 */
export function authRedirectTarget(input: {
  pathname: string;
  search: string;
  hasSession: boolean;
  demo: boolean;
}): string | null {
  if (input.demo || input.hasSession) {
    return null;
  }
  if (
    isSignInPath(input.pathname) ||
    input.pathname === "/api" ||
    input.pathname.startsWith("/api/")
  ) {
    return null;
  }
  return signInPath(`${input.pathname}${input.search}`);
}

function isSignInPath(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0] ?? pathname;
  return path === "/sign-in" || path.startsWith("/sign-in/");
}

function isAppPath(value: string): boolean {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return false;
  }
  if (value.includes("\\") || value.includes("://") || value.includes("..")) {
    return false;
  }
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) {
      return false;
    }
  }
  return true;
}
