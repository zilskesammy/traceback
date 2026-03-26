// middleware.ts — Schützt App- und API-Routen, leitet unauthentifizierte User zu /login

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // Webhook-Route ist öffentlich (GitHub sendet kein Session-Cookie)
  if (pathname.startsWith("/api/webhooks/")) {
    return NextResponse.next();
  }

  // Docs sind öffentlich lesbar
  if (pathname.startsWith("/docs")) {
    return NextResponse.next();
  }

  // Auth-Routen sind immer zugänglich
  if (
    pathname.startsWith("/api/auth/") ||
    pathname === "/login" ||
    pathname === "/"
  ) {
    // Eingeloggter User auf /login → zum Dashboard
    if (isAuthenticated && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Alle anderen Routen (App + API) erfordern Auth
  if (!isAuthenticated) {
    // API-Aufrufe ohne Auth → 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    // Seiten → zu /login weiterleiten
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Matcher schließt statische Dateien und _next aus
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
