// middleware.ts
import { withAuth } from "next-auth/middleware";
import type { NextRequest } from "next/server";

export default withAuth(
  function middleware(_req: NextRequest) {},
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        // Allow NextAuth endpoints & sign-in page
        if (pathname.startsWith("/api/auth")) return true;
        if (pathname === "/signin") return true;

        // Allow static assets
        if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") return true;

        // All app pages and API routes require a session token
        return !!token;
      },
    },
    pages: {
      signIn: "/signin",
    },
  }
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};