// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";

type Ticket = {
  _id: string;
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  category: "Hardware" | "Software" | "Network" | "Other";
  createdAt: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      // For demo: fetch up to 1000
      const res = await fetch("/api/tickets?page=1&pageSize=1000", { cache: "no-store" });
      const json = await res.json();
      setTickets(json.data ?? []);
      setLoading(false);
    }
    loadAll();
  }, []);

  const byStatus = ["Open","In Progress","Resolved","Closed"].map((s) => ({
    label: s, count: tickets.filter((t) => t.status === (s as any)).length,
  }));
  const byCategory = ["Hardware","Software","Network","Other"].map((c) => ({
    label: c, count: tickets.filter((t) => t.category === (c as any)).length,
  }));

  const last7 = Date.now() - 7 * 24 * 3600 * 1000;
  const resolvedLast7 = tickets.filter((t) => t.status === "Resolved" || t.status === "Closed")
    .filter((t) => new Date(t.updatedAt).getTime() >= last7).length;

return (
  <div className="space-y-6 min-w-0">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      {loading ? <div>Loading…</div> : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 min-w-0">
            <KPI title="Open" value={byStatus[0].count} />
            <KPI title="In Progress" value={byStatus[1].count} />
            <KPI title="Resolved/Closed (7d)" value={resolvedLast7} />
            <KPI title="Total Tickets" value={tickets.length} />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 min-w-0">
            <Bar title="By Status" data={byStatus} />
            <Bar title="By Category" data={byCategory} />
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 p-4 min-w-0 overflow-visible">
      <div className="text-sm opacity-80">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Bar({ title, data }: { title: string; data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="rounded-xl border border-slate-800 p-4 min-w-0 overflow-visible">
      <div className="mb-3 text-sm opacity-80">{title}</div>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 min-w-0">
            <div className="w-28 text-sm">{d.label}</div>
            <div className="h-3 flex-1 rounded bg-slate-800 min-w-0">
              <div className="h-3 rounded bg-slate-500" style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
            <div className="w-10 text-right text-sm tabular-nums">{d.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}