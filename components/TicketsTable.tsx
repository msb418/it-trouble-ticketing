"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

type Ticket = {
  _id: string;
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  category: "Hardware" | "Software" | "Network" | "Other";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  reporterName: string;
  reporterEmail: string;
  assignee: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
};

type User = { _id: string; name: string; email: string; role: "admin" | "user" };

type SortKey = "title" | "priority" | "category" | "status" | "assignee" | "createdAt";

export default function TicketsTable() {
  const router = useRouter();
  const { data: session } = useSession();
  const myEmail = session?.user?.email ?? "";
  const isAdmin = (session?.user as any)?.role === "admin";

  const [data, setData] = useState<Ticket[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | Ticket["status"]>("");
  const [priorityFilter, setPriorityFilter] = useState<"" | Ticket["priority"]>("");
  const [categoryFilter, setCategoryFilter] = useState<"" | Ticket["category"]>("");
  const [showArchived, setShowArchived] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [usersErr, setUsersErr] = useState<string>("");
  const [busyArchive, setBusyArchive] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<"delete" | "archive">("delete");
  const [confirmCount, setConfirmCount] = useState(0);
  const [confirmingBusy, setConfirmingBusy] = useState(false);
  const confirmActionRef = useRef<null | (() => Promise<void>)>(null);

  useEffect(() => {
    async function loadUsers() {
      if (!isAdmin) return;
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
        const json = await res.json();
        setUsers(Array.isArray(json.data) ? json.data : []);
        setUsersErr("");
      } catch (e: any) {
        setUsers([]);
        setUsersErr(e?.message || "Failed to load users");
      }
    }
    loadUsers();
  }, [isAdmin]);

  // include current admin as selectable if missing
  const assigneeOptions = useMemo(() => {
    const list = [...users];
    if (isAdmin) {
      const sesEmail = (session?.user?.email || "").toLowerCase();
      if (sesEmail && !list.some(u => u.email.toLowerCase() === sesEmail)) {
        list.push({
          _id: "session-admin",
          name: session?.user?.name || "Admin",
          email: session?.user?.email || "",
          role: "admin",
        } as User);
      }
    }
    return list.sort((a, b) => {
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      const an = (a.name || "").toLowerCase();
      const bn = (b.name || "").toLowerCase();
      if (an !== bn) return an < bn ? -1 : 1;
      const ae = (a.email || "").toLowerCase();
      const be = (b.email || "").toLowerCase();
      if (ae !== be) return ae < be ? -1 : 1;
      return 0;
    });
  }, [users, isAdmin, session?.user]);

  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);

  const lastAutoRefreshAt = useRef(0);
  const currentFetch = useRef<AbortController | null>(null);

  async function load() {
    currentFetch.current?.abort();
    const ctrl = new AbortController();
    currentFetch.current = ctrl;

    setLoading(true);
    setErrorMsg("");
    try {
      const url = new URL("/api/tickets", window.location.origin);
      if (showArchived) url.searchParams.set("archived", "1");
      if (q) url.searchParams.set("q", q);
      if (statusFilter) url.searchParams.set("status", statusFilter);
      if (mineOnly) url.searchParams.set("mine", "1");

      const res = await fetch(url.toString(), { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) throw new Error(`Failed to fetch tickets: ${res.status}`);
      const json = await res.json();
      setData(json.data ?? []);
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        (json.data ?? []).forEach((t: Ticket) => {
          if (prev[t._id]) next[t._id] = true;
        });
        return next;
      });
      setPage(1);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setErrorMsg(err.message ?? "Failed to load tickets");
      setData([]);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mineOnly && !myEmail) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, mineOnly, myEmail, showArchived]);

  // debounced search
  useEffect(() => {
    const h = setTimeout(() => {
      if (mineOnly && !myEmail) return;
      load();
    }, 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, mineOnly, myEmail, showArchived]);

  useEffect(() => {
    function maybeRefresh() {
      const now = Date.now();
      if (now - lastAutoRefreshAt.current < 500) return;
      lastAutoRefreshAt.current = now;
      load();
    }
    const onFocus = () => maybeRefresh();
    const onVisibility = () => {
      if (!document.hidden) maybeRefresh();
    };
    const onChanged = () => maybeRefresh();
    const onPageShow = () => maybeRefresh();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("tickets:changed" as any, onChanged as any);
    window.addEventListener("pageshow", onPageShow);

    const onCreated = (e: Event) => {
      const ce = e as CustomEvent<Ticket | undefined>;
      const t = ce.detail;
      if (!t) return maybeRefresh();
      setData((prev) => (prev.some((p) => p._id === t._id) ? prev : [t, ...prev]));
    };
    window.addEventListener("tickets:created" as any, onCreated as any);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("tickets:changed" as any, onChanged as any);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("tickets:created" as any, onCreated as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAll(checked: boolean) {
    if (checked) {
      const all: Record<string, boolean> = {};
      data.forEach((t) => (all[t._id] = true));
      setSelected(all);
    } else setSelected({});
  }
  function toggleOne(id: string, checked: boolean) {
    setSelected((s) => ({ ...s, [id]: checked }));
  }

  function openConfirm(kind: "delete" | "archive", count: number, onConfirm: () => Promise<void>) {
    setConfirmKind(kind);
    setConfirmCount(count);
    confirmActionRef.current = onConfirm;
    setConfirmOpen(true);
  }

  async function deleteSelected() {
    if (!isAdmin || selectedIds.length === 0) return;
    openConfirm("delete", selectedIds.length, deleteSelectedInternal);
  }

  async function deleteSelectedInternal() {
    const res = await fetch("/api/tickets/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      alert(e?.error ?? `Bulk delete failed (${res.status})`);
      return;
    }
    setSelected({});
    await load();
  }

  async function archiveSelected() {
    if (!isAdmin || selectedIds.length === 0) return;
    openConfirm("archive", selectedIds.length, archiveSelectedInternal);
  }

  async function archiveSelectedInternal() {
    try {
      setBusyArchive(true);
      for (const id of selectedIds) {
        const res = await fetch(`/api/tickets/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "archived", value: true }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(t || `Failed to archive ${id}`);
        }
      }
      setSelected({});
      await load();
    } catch (e) {
      alert((e as Error).message || "Failed to archive selected");
    } finally {
      setBusyArchive(false);
    }
  }

  function exportCSV(rows: Ticket[]) {
    const headers = [
      "Title",
      "Priority",
      "Category",
      "Status",
      "Reporter",
      "Reporter Email",
      "Assignee",
      "Created At",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((t) =>
        [
          t.title,
          t.priority,
          t.category,
          t.status,
          t.reporterName,
          t.reporterEmail,
          t.assignee,
          new Date(t.createdAt).toISOString(),
        ]
          .map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tickets.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function updateField(id: string, field: keyof Ticket, value: string) {
    // Permissions:
    // - Admins: can edit all fields
    // - Regular users: can edit status/priority/category for tickets they reported OR are assigned to
    // - Only admins can reassign
    if (!isAdmin) {
      if (field === "assignee") return;
      const t = data.find((d) => d._id === id);
      const me = (myEmail || "").toLowerCase();
      const isMine =
        !!t &&
        (t.assignee?.toLowerCase() === me || t.reporterEmail?.toLowerCase() === me);
      if (!isMine) return;
    }

    const original = data.find((d) => d._id === id)?.[field] as unknown as string | undefined;
    if (String(original ?? "") === String(value ?? "")) return;

    // optimistic update
    setData((prev) =>
      prev.map((t) => (t._id === id ? ({ ...t, [field]: value } as Ticket) : t))
    );

    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });

    if (!res.ok) {
      setData((prev) =>
        prev.map((t) => (t._id === id ? ({ ...t, [field]: original } as Ticket) : t))
      );
      alert("Failed to update ticket");
      return;
    }

    load();
  }

  const fmt = (d: string) =>
    `${new Date(d).toLocaleDateString(undefined, {
      year: "2-digit",
      month: "numeric",
      day: "numeric",
    })} ${new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  // ----- Derived rows -----
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const fromTs = dateFrom ? Date.parse(dateFrom) : null;
    const toTs = dateTo ? Date.parse(dateTo) + 24 * 60 * 60 * 1000 - 1 : null;

    return data.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (mineOnly && myEmail) {
        const mine =
          t.assignee?.toLowerCase() === myEmail.toLowerCase() ||
          t.reporterEmail?.toLowerCase() === myEmail.toLowerCase();
        if (!mine) return false;
      }
      if (fromTs && Date.parse(t.createdAt) < fromTs) return false;
      if (toTs && Date.parse(t.createdAt) > toTs) return false;
      if (!ql) return true;
      const hay = `${t.title} ${t.description} ${t.reporterName} ${t.reporterEmail} ${t.assignee}`.toLowerCase();
      return hay.includes(ql);
    });
  }, [data, statusFilter, priorityFilter, categoryFilter, dateFrom, dateTo, mineOnly, myEmail, q]);

  const [sortByState, sortDirState] = [sortBy, sortDir];
  const sorted = useMemo(() => {
    const dir = sortDirState === "asc" ? 1 : -1;
    const priOrder = { Low: 0, Medium: 1, High: 2, Urgent: 3 } as const;
    return [...filtered].sort((a, b) => {
      let va: any = a[sortByState];
      let vb: any = b[sortByState];
      if (sortByState === "createdAt") {
        va = Date.parse(a.createdAt);
        vb = Date.parse(b.createdAt);
      } else if (sortByState === "priority") {
        va = priOrder[a.priority];
        vb = priOrder[b.priority];
      } else {
        va = String(va || "").toLowerCase();
        vb = String(vb || "").toLowerCase();
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtered, sortByState, sortDirState]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  function onSort(key: SortKey) {
    setPage(1);
    setSortBy((prev) => (prev === key ? prev : key));
    setSortDir((prev) => (sortBy === key ? (prev === "asc" ? "desc" : "asc") : "asc"));
  }

  const sortIcon = (key: SortKey) => (
    <span className="ml-1 inline-block select-none opacity-70">
      {sortBy === key ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="rounded-2xl border border-slate-800">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-1">
            {["", "Open", "In Progress", "Resolved", "Closed"].map((s) => (
              <button
                key={s || "all"}
                onClick={() => setStatusFilter(s as any)}
                className={`px-3 py-1.5 rounded-md text-sm ${
                  statusFilter === s ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {s || "All"}
              </button>
            ))}
          </div>

          <label className="ml-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
              disabled={!myEmail}
              title={!myEmail ? "Sign in to use My Tickets" : "Show tickets assigned to or reported by me"}
            />
            My Tickets
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              title="Include archived tickets"
            />
            Show archived
          </label>

          <select
            className="rounded bg-slate-900 p-2 border border-slate-700"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
          >
            <option value="">Priority: All</option>
            {(["Low", "Medium", "High", "Urgent"] as const).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            className="rounded bg-slate-900 p-2 border border-slate-700"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
          >
            <option value="">Category: All</option>
            {(["Hardware", "Software", "Network", "Other"] as const).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              className="rounded bg-slate-900 p-2 border border-slate-700"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Created on/after"
              aria-label="Created on or after"
            />
            <span className="px-1 text-slate-400 select-none" aria-hidden="true">–</span>
            <input
              type="date"
              className="rounded bg-slate-900 p-2 border border-slate-700"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Created on/before"
              aria-label="Created on or before"
            />
          </div>

          <input
            className="w-64 rounded bg-slate-900 p-2"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
              if (e.key === "Escape") setQ("");
            }}
          />
          <button onClick={load} className="rounded bg-slate-700 px-3 py-1.5">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        <div className="flex items-center gap-2 pr-2">
          <button onClick={() => exportCSV(sorted)} className="rounded bg-slate-700 px-3 py-1.5">
            Export CSV
          </button>
          {isAdmin && (
            <>
              <button
                onClick={archiveSelected}
                className={`rounded px-3 py-1.5 ${
                  selectedIds.length && !busyArchive
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-amber-900/60 cursor-not-allowed"
                }`}
                disabled={!selectedIds.length || busyArchive}
                title="Move selected tickets to the archive"
              >
                {busyArchive ? "Archiving…" : "Archive Selected"}
              </button>
              <button
                onClick={deleteSelected}
                className={`rounded px-3 py-1.5 ${
                  selectedIds.length ? "bg-rose-700 hover:bg-rose-600" : "bg-rose-900/60 cursor-not-allowed"
                }`}
                disabled={!selectedIds.length}
              >
                Delete Selected
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && <div className="px-3 pb-2 text-sm text-rose-400">{errorMsg}</div>}
      {usersErr && isAdmin && <div className="px-3 pb-2 text-sm text-amber-400">Users: {usersErr}</div>}

      {/* Table */}
      <div className="px-3 pb-3 overflow-x-auto">
        <table className="table-fixed min-w-[1080px] w-full border-collapse">
          <thead className="bg-slate-900/50 text-sm">
            <tr className="border-b border-slate-800">
              <th className="w-[44px] py-2 pr-2 text-left">
                <input
                  type="checkbox"
                  className="accent-slate-500"
                  checked={pageRows.length > 0 && pageRows.every((t) => !!selected[t._id])}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </th>
              <th className="w-[28%] py-2 text-left">
                <button onClick={() => onSort("title")} className="hover:underline">
                  Title {sortIcon("title")}
                </button>
              </th>
              <th className="w-[112px] py-2 text-left">
                <button onClick={() => onSort("priority")} className="hover:underline">
                  Priority {sortIcon("priority")}
                </button>
              </th>
              <th className="w-[128px] py-2 text-left">
                <button onClick={() => onSort("category")} className="hover:underline">
                  Category {sortIcon("category")}
                </button>
              </th>
              <th className="w-[128px] py-2 text-left">
                <button onClick={() => onSort("status")} className="hover:underline">
                  Status {sortIcon("status")}
                </button>
              </th>
              <th className="w-[16%] py-2 text-left">Reporter</th>
              <th className="w-[220px] py-2 text-left">
                <button onClick={() => onSort("assignee")} className="hover:underline">
                  Assignee {sortIcon("assignee")}
                </button>
              </th>
              <th className="w-[168px] py-2 pr-2 text-right">
                <button onClick={() => onSort("createdAt")} className="hover:underline">
                  Created {sortIcon("createdAt")}
                </button>
              </th>
            </tr>
          </thead>

          <tbody className="text-sm">
            {pageRows.map((t) => {
              const go = () => router.push(`/tickets/${t._id}`);
              return (
                <tr
                  key={t._id}
                  onClick={go}
                  className={`border-b border-slate-800 cursor-pointer ${t.archived ? "opacity-70" : "hover:bg-slate-900/40"}`}
                >
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      className="accent-slate-500"
                      checked={!!selected[t._id]}
                      onChange={(e) => toggleOne(t._id, e.target.checked)}
                      onClick={stop}
                    />
                  </td>

                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/tickets/${t._id}`}
                        prefetch={false}
                        className="block max-w-[28ch] truncate text-sky-400 hover:underline"
                        onClick={stop}
                        title={t.title}
                      >
                        {t.title}
                      </Link>
                      {t.archived ? (
                        <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 border border-slate-700" title="Archived">
                          Archived
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="py-2">
                    <select
                      onClick={stop}
                      value={t.priority}
                      onChange={(e) => updateField(t._id, "priority", e.target.value)}
                      className="w-28 bg-slate-900 border border-slate-700 rounded px-1 py-0.5"
                      disabled={
                        t.archived || !(
                          isAdmin ||
                          t.assignee?.toLowerCase() === (myEmail || "").toLowerCase() ||
                          t.reporterEmail?.toLowerCase() === (myEmail || "").toLowerCase()
                        )
                      }
                    >
                      {["Low", "Medium", "High", "Urgent"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </td>

                  <td className="py-2">
                    <select
                      onClick={stop}
                      value={t.category}
                      onChange={(e) => updateField(t._id, "category", e.target.value)}
                      className="w-32 bg-slate-900 border border-slate-700 rounded px-1 py-0.5"
                      disabled={
                        t.archived || !(
                          isAdmin ||
                          t.assignee?.toLowerCase() === (myEmail || "").toLowerCase() ||
                          t.reporterEmail?.toLowerCase() === (myEmail || "").toLowerCase()
                        )
                      }
                    >
                      {["Hardware", "Software", "Network", "Other"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </td>

                  <td className="py-2">
                    <select
                      onClick={stop}
                      value={t.status}
                      onChange={(e) => updateField(t._id, "status", e.target.value)}
                      className="w-32 bg-slate-900 border border-slate-700 rounded px-1 py-0.5"
                      disabled={
                        t.archived || !(
                          isAdmin ||
                          t.assignee?.toLowerCase() === (myEmail || "").toLowerCase() ||
                          t.reporterEmail?.toLowerCase() === (myEmail || "").toLowerCase()
                        )
                      }
                    >
                      {["Open", "In Progress", "Resolved", "Closed"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>

                  <td className="py-2 px-2">
                    <div className="truncate" title={`${t.reporterName} <${t.reporterEmail}>`}>
                      {t.reporterName}
                    </div>
                  </td>

                  <td className="py-2">
                    {isAdmin ? (
                      <select
                        onClick={stop}
                        value={t.assignee ?? ""}
                        onChange={(e) => updateField(t._id, "assignee", e.target.value)}
                        className="w-[220px] max-w-[220px] truncate bg-slate-900 border border-slate-700 rounded px-1 py-0.5"
                        title={t.assignee || "Unassigned"}
                        disabled={t.archived}
                      >
                        <option value="">Unassigned</option>
                        {assigneeOptions.map((u) => (
                          <option key={u._id} value={u.email}>
                            {u.name} ({u.email}){u.role === "admin" ? " · admin" : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="truncate max-w-[220px]" title={t.assignee || "Unassigned"}>
                        {t.assignee || <span className="opacity-60">Unassigned</span>}
                      </div>
                    )}
                  </td>

                  <td className="py-2 pr-2 text-right whitespace-nowrap tabular-nums">
                    {fmt(t.createdAt)}
                  </td>
                </tr>
              );
            })}

            {pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  {mineOnly ? "No tickets assigned to or reported by you yet." : "No tickets to show"}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="opacity-70">Rows per page</span>
            <select
              className="rounded bg-slate-900 border border-slate-700 p-1"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded bg-slate-800 px-2 py-1 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              className="rounded bg-slate-800 px-2 py-1 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    {/* Modal for confirm actions */}
    {confirmOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm rounded-xl bg-slate-900 p-4 shadow-xl ring-1 ring-slate-700">
          <h3 className="text-base font-semibold mb-2">
            {confirmKind === "delete" ? "Delete selected tickets?" : "Archive selected tickets?"}
          </h3>
          <p className="mb-4 text-sm text-slate-300">
            {confirmKind === "delete"
              ? `You are about to delete ${confirmCount} ticket(s). This action cannot be undone.`
              : `You are about to archive ${confirmCount} ticket(s). You can view them later with "Show archived".`}
          </p>
          <div className="flex justify-end gap-2">
            <button
              className="rounded bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
              onClick={() => {
                if (confirmingBusy) return;
                setConfirmOpen(false);
                setConfirmCount(0);
                confirmActionRef.current = null;
              }}
              disabled={confirmingBusy}
            >
              Cancel
            </button>
            <button
              className={`rounded px-3 py-1.5 text-sm ${
                confirmKind === "delete" ? "bg-rose-700 hover:bg-rose-600" : "bg-amber-600 hover:bg-amber-500"
              } ${confirmingBusy ? "opacity-70 cursor-not-allowed" : ""}`}
              onClick={async () => {
                if (!confirmActionRef.current) return;
                try {
                  setConfirmingBusy(true);
                  await confirmActionRef.current();
                  setConfirmOpen(false);
                  setConfirmCount(0);
                  confirmActionRef.current = null;
                } finally {
                  setConfirmingBusy(false);
                }
              }}
              disabled={confirmingBusy}
            >
              {confirmingBusy ? (confirmKind === "delete" ? "Deleting…" : "Archiving…") : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}