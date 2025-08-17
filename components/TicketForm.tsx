"use client";
import { useMemo, useState } from "react";

const priorities = ["Low", "Medium", "High", "Urgent"] as const;
const categories = ["Hardware", "Software", "Network", "Other"] as const;

export default function TicketForm() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "Low",
    category: "Other",
    reporterName: "",
    reporterEmail: "",
  });

  const isValid = useMemo(() => {
    return (
      form.title.trim().length > 0 &&
      form.description.trim().length > 0 &&
      form.reporterName.trim().length > 0 &&
      form.reporterEmail.trim().length > 0
    );
  }, [form]);

  async function submit() {
    setErrorMsg(null);
    if (!isValid) {
      setErrorMsg("Please fill in Title, Description, Reporter name, and Reporter email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const text = await res.text(); // read once
      let payload: any = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        // ignore, we'll fall back to generic error below
      }

      if (!res.ok) {
        const msg =
          payload?.error ||
          (typeof payload === "string" ? payload : "") ||
          text ||
          `Request failed (${res.status})`;
        throw new Error(msg);
      }

      // success
      setForm({
        title: "",
        description: "",
        priority: "Low",
        category: "Other",
        reporterName: "",
        reporterEmail: "",
      });
      if (payload?.data) {
        window.dispatchEvent(new CustomEvent("tickets:created", { detail: payload.data }));
      } else {
        window.dispatchEvent(new Event("tickets:changed"));
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to create ticket");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 p-4">
      <h2 className="mb-3 text-lg font-semibold">New Ticket</h2>

      {errorMsg && (
        <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {errorMsg}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded bg-slate-900 p-2"
          placeholder="Title *"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        <select
          className="rounded bg-slate-900 p-2"
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
        >
          {priorities.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>

        <select
          className="rounded bg-slate-900 p-2"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <input
          className="rounded bg-slate-900 p-2"
          placeholder="Reporter name *"
          value={form.reporterName}
          onChange={(e) => setForm({ ...form, reporterName: e.target.value })}
        />

        <input
          className="rounded bg-slate-900 p-2"
          placeholder="Reporter email *"
          value={form.reporterEmail}
          onChange={(e) => setForm({ ...form, reporterEmail: e.target.value })}
        />

        <textarea
          className="sm:col-span-2 rounded bg-slate-900 p-2"
          rows={4}
          placeholder="Description *"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={loading || !isValid}
          className={`rounded px-4 py-2 ${
            loading || !isValid ? "bg-emerald-800/60 cursor-not-allowed" : "bg-emerald-600"
          }`}
        >
          {loading ? "Creating..." : "Create Ticket"}
        </button>
      </div>
    </div>
  );
}