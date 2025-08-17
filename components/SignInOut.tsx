// components/SignInOut.tsx
"use client";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function SignInOut() {
  const { data } = useSession();
  return data ? (
    <button onClick={() => signOut({ callbackUrl: "/signin" })}
      className="rounded bg-slate-700 px-3 py-1.5 hover:bg-slate-600">
      Sign out
    </button>
  ) : (
    <Link href="/signin" className="rounded bg-slate-700 px-3 py-1.5 hover:bg-slate-600">
      Sign in
    </Link>
  );
}