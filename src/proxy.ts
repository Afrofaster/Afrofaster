import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/offline", "/api/health", "/manifest.webmanifest", "/sw.js"];

/**
 * Optimistic auth redirect only (cookie presence). Real validation happens
 * server-side in every page, Server Action and route handler.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (!request.cookies.has("lia_session")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|favicon.ico|icon.svg|apple-touch-icon.png|robots.txt).*)"],
};
