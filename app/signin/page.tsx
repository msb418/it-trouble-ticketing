// app/signin/page.tsx
"use client";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.ok) router.push("/");
    else alert("Invalid email or password.");
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded bg-slate-900 p-2" type="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded bg-slate-900 p-2" type="password" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <button disabled={busy} className="w-full rounded bg-emerald-600 p-2 disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-4 flex gap-2">
        <button onClick={() => { setEmail("admin@example.com"); setPassword("admin123"); }}
          className="rounded bg-slate-700 px-3 py-1.5 text-sm">Fill Admin</button>
        <button onClick={() => { setEmail("user@example.com"); setPassword("user123"); }}
          className="rounded bg-slate-700 px-3 py-1.5 text-sm">Fill User</button>
      </div>
    </div>
  );
}