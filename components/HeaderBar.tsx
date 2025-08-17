"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function HeaderBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const role = (session?.user as any)?.role ?? "";
  const email = session?.user?.email ?? "";
  const isAdmin = role === "admin";
  const isUsers = pathname?.startsWith("/users");

  if (status === "loading") {
    return (
      <header className="border-b border-slate-800">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4" />
      </header>
    );
  }

  return (
    <header className="border-b border-slate-800">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Left: brand + links */}
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className={`font-semibold hover:opacity-90 ${
              pathname === "/" ? "text-white" : "text-slate-100"
            }`}
          >
            Helpdesk Tickets
          </Link>

          {isAdmin && (
            <Link
              href="/users"
              className={`text-sm hover:text-white ${
                isUsers ? "text-white" : "text-slate-300"
              }`}
            >
              Users
            </Link>
          )}
        </nav>

        {/* Right: auth */}
        <div className="flex items-center gap-3 text-sm">
          {session ? (
            <>
              <span className="hidden sm:inline text-slate-300">
                Signed in as <span className="text-slate-200">{email}</span>
                {role && (
                  <>
                    {" · "}Role: <span className="text-slate-200">{role}</span>
                  </>
                )}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="rounded bg-slate-700 px-3 py-1.5 hover:bg-slate-600"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/signin"
              className="rounded bg-slate-700 px-3 py-1.5 hover:bg-slate-600"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}