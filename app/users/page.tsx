// app/users/page.tsx
"use client";

import { useEffect, useState } from "react";

type User = { _id: string; name: string; email: string; role: "admin" | "user"; createdAt: string };

export default function UsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [password, setPassword] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setItems(json.data || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    setErr(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, password }),
      });
      if (!res.ok) throw new Error(await res.text());
      setName(""); setEmail(""); setPassword(""); setRole("user");
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to create user");
    }
  }

  async function changeRole(id: string, next: "admin" | "user") {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to update role");
    }
  }

  async function resetPassword(id: string) {
    const pw = prompt("Enter new password");
    if (!pw) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert("Password updated.");
    } catch (e: any) {
      alert(e?.message || "Failed to reset password");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to delete user");
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>

      {/* Create form */}
      <div className="rounded-xl border border-slate-800 p-4">
        <h2 className="mb-3 font-semibold">Create User</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className="rounded bg-slate-900 p-2" placeholder="Name" value={name} onChange={(e)=>setName(e.target.value)} />
          <input className="rounded bg-slate-900 p-2" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <select className="rounded bg-slate-900 p-2" value={role} onChange={(e)=>setRole(e.target.value as any)}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <input className="rounded bg-slate-900 p-2" type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        </div>
        <div className="mt-3">
          <button onClick={create} className="rounded bg-emerald-600 px-3 py-1.5">Create</button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-slate-800 p-4">
        <h2 className="mb-3 font-semibold">All Users</h2>
        {err && <div className="mb-3 text-rose-300">{err}</div>}
        {loading ? (
          <div className="opacity-70">Loading…</div>
        ) : (
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="text-left text-slate-300">
                <th className="w-2/5 px-3 py-2">Name / Email</th>
                <th className="w-1/5 px-3 py-2">Role</th>
                <th className="w-1/5 px-3 py-2">Created</th>
                <th className="w-1/5 px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(u => (
                <tr key={u._id} className="border-t border-slate-800">
                  <td className="px-3 py-2">
                    <div className="truncate">{u.name}</div>
                    <div className="truncate text-slate-400 text-sm">{u.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded bg-slate-900 p-1.5"
                      value={u.role}
                      onChange={(e)=>changeRole(u._id, e.target.value as any)}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">{new Date(u.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={()=>resetPassword(u._id)} className="rounded bg-slate-700 px-2 py-1 text-sm">Reset PW</button>
                      <button onClick={()=>remove(u._id)} className="rounded bg-rose-700 px-2 py-1 text-sm">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td className="px-3 py-6 text-center text-slate-400" colSpan={4}>No users yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}