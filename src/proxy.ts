import { NextResponse, type NextRequest } from "next/server";

import { isDemoData } from "@/config/demo";
import { authRedirectTarget } from "@/features/auth/return-path";
import { SESSION_COOKIE } from "@/server/auth/cookie";

export function proxy(request: NextRequest) {
  const target = authRedirectTarget({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    hasSession: Boolean(request.cookies.get(SESSION_COOKIE)?.value),
    demo: isDemoData(),
  });
  if (!target) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
