// components/TicketDetail.tsx
type User = {
  _id: string;
  name: string;
  email: string;
  role?: string; // 'admin' | 'user'
};
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  audit?: {
    at: string | Date;
    by: string;
    changes: string[]; // e.g. ["Status: Open → In Progress", "Description updated"]
  }[];
  archived?: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
};

type Comment = {
  _id: string;
  ticketId: string;
  author: string;
  body: string;
  internal?: boolean;
  createdAt: string;
};

const PRIORITIES: Ticket["priority"][] = ["Low", "Medium", "High", "Urgent"];
const CATEGORIES: Ticket["category"][] = ["Hardware", "Software", "Network", "Other"];
const STATUSES: Ticket["status"][] = ["Open", "In Progress", "Resolved", "Closed"];

export default function TicketDetail({ ticket }: { ticket: Ticket }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const idRef = useRef(ticket._id);
  const [t, setT] = useState(ticket);
  const [assigneeInput, setAssigneeInput] = useState(ticket.assignee || "");
  const [saving, setSaving] = useState(false);

  // Users for assignee dropdown
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [cBody, setCBody] = useState("");
  const [cInternal, setCInternal] = useState(false);
  const [cErr, setCErr] = useState<string | null>(null);

  // Description edit state
  const [desc, setDesc] = useState(ticket.description);
  const [savingDesc, setSavingDesc] = useState(false);
  const [descDirty, setDescDirty] = useState(false);

  async function refreshTicket() {
    try {
      const res = await fetch(`/api/tickets/${idRef.current}`, { cache: "no-store" });
      if (!res.ok) return;
      const payload = await res.json().catch(() => null);
      const fresh = (payload && (payload.data || payload)) as Ticket | null;
      if (fresh) setT(fresh);
    } catch {
      // ignore refresh errors; UI already optimistic
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch(`/api/users?all=1`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load users"));
      const payload = await res.json().catch(() => null);
      const list: User[] = (payload && (payload.data || payload)) || [];
      if (Array.isArray(list)) setUsers(list);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }

  async function patch(patch: Partial<Ticket>) {
    setSaving(true);
    // Optimistically merge changed fields for snappy UI
    setT((prev) => ({ ...prev, ...patch }));
    try {
      const res = await fetch(`/api/tickets/${idRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Failed to save");
      try {
        window.dispatchEvent(new Event("tickets:changed"));
      } catch {}
      await refreshTicket();
    } catch (e: any) {
      alert(e?.message || "Failed to save");
      await refreshTicket();
    } finally {
      setSaving(false);
    }
  }

  async function loadComments() {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/tickets/${idRef.current}/comments`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text().catch(() => "Failed to load comments"));
      const data = (await res.json()) as Comment[];
      setComments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setCErr(e?.message || "Failed to load comments");
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }

  async function addComment() {
    if (t.archived) return;
    const body = cBody.trim();
    if (!body) return;

    setCErr(null);
    try {
      const res = await fetch(`/api/tickets/${idRef.current}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, internal: cInternal }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "Failed to add comment");
        throw new Error(msg || "Failed to add comment");
      }
      // clear inputs and refresh
      setCBody("");
      setCInternal(false);
      await loadComments();
      // also refresh ticket so 'Updated' time reflects comment creation
      await refreshTicket();
    } catch (e: any) {
      setCErr(e?.message || "Failed to add comment");
    }
  }

  async function saveAssignee() {
    const next = assigneeInput.trim();
    if ((t.assignee || "") === next) return;
    await patch({ assignee: next });
  }

  async function saveDescription() {
    if (t.archived) {
      setDescDirty(false);
      return;
    }
    const next = desc.trim();
    if (next === t.description) {
      setDescDirty(false);
      return;
    }
    setSavingDesc(true);
    try {
      setDesc(next);
      await patch({ description: next });
      await refreshTicket();
      setDescDirty(false);
    } catch {
    } finally {
      setSavingDesc(false);
    }
  }

  useEffect(() => {
    void refreshTicket();
    loadComments();
    setAssigneeInput(ticket.assignee || "");
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!descDirty) {
      setDesc(t.description);
    }
  }, [t.description, descDirty]);

  useEffect(() => {
    const onChanged = () => {
      void refreshTicket();
    };
    window.addEventListener("tickets:changed", onChanged);
    return () => window.removeEventListener("tickets:changed", onChanged);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        if (descDirty) {
          e.preventDefault();
          void saveDescription();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [descDirty, desc]);

  const assigneeLabel = useMemo(() => {
    if (!t.assignee) return "—";
    const u = users.find((u) => u.email === t.assignee || u.name === t.assignee);
    if (u) return `${u.name || u.email}${u.email ? ` <${u.email}>` : ""}`;
    return t.assignee;
  }, [t.assignee, users]);

  const meta = useMemo(
    () => [
      { label: "Reporter", value: `${t.reporterName} <${t.reporterEmail}>` },
      { label: "Assignee", value: assigneeLabel },
      { label: "Created", value: new Date(t.createdAt).toLocaleString() },
      { label: "Updated", value: new Date(t.updatedAt).toLocaleString() },
    ],
    [t, assigneeLabel]
  );

  const activity = useMemo(() => {
    const raw: any[] = (t as any).audit ?? (t as any).activity ?? [];
    if (!Array.isArray(raw))
      return [] as { at: string | Date; by: string; changes: string[] }[];

    const toLabel = (field: string) =>
      String(field).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

    const list = raw.map((e: any) => {
      const at = e.at ?? e.date ?? e.when ?? new Date().toISOString();
      const by = e.by ?? e.user ?? "";
      let changes: string[] = [];

      if (Array.isArray(e.changes) && e.changes.length) {
        changes = e.changes;
      } else if (typeof e.change === "string") {
        changes = [e.change];
      } else if (e.field) {
        const label = toLabel(e.field);
        if (e.field === "description") {
          changes = ["Description updated"];
        } else {
          const from = e.from ?? "—";
          const to = e.to ?? "—";
          changes = [`${label}: ${from} → ${to}`];
        }
      }

      return { at, by, changes };
    });

    return list.sort(
      (a, b) => new Date(b.at as any).getTime() - new Date(a.at as any).getTime()
    );
  }, [t]);

  const lastActivityRef = useRef<{ at: string | Date; by: string; changes: string[] }[]>(
    []
  );
  useEffect(() => {
    if (activity.length > 0) {
      lastActivityRef.current = activity;
    }
  }, [activity]);

  const activityToShow = activity.length > 0 ? activity : lastActivityRef.current;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          {t.title}
          {t.archived ? (
            <span className="text-xs uppercase tracking-wide rounded bg-slate-800 border border-slate-700 px-2 py-0.5">
              Archived
            </span>
          ) : null}
        </h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => patch({ archive: !t.archived } as any)}
              className="rounded bg-slate-700 px-3 py-1.5 hover:bg-slate-600"
              title={t.archived ? "Restore ticket" : "Archive ticket"}
            >
              {t.archived ? "Restore" : "Archive"}
            </button>
          )}
          <Link href="/" className="rounded bg-slate-700 px-3 py-1.5">
            Back
          </Link>
        </div>
      </div>

      {/* Quick edit bar */}
      <div className="rounded-xl border border-slate-800 p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
        <select
          className={`rounded bg-slate-900 p-2 ${
            t.archived ? "opacity-60 cursor-not-allowed" : ""
          }`}
          value={t.status}
          onChange={(e) =>
            !t.archived && patch({ status: e.target.value as Ticket["status"] })
          }
          disabled={saving || t.archived}
        >
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className={`rounded bg-slate-900 p-2 ${
            t.archived ? "opacity-60 cursor-not-allowed" : ""
          }`}
          value={t.priority}
          onChange={(e) =>
            !t.archived && patch({ priority: e.target.value as Ticket["priority"] })
          }
          disabled={saving || t.archived}
        >
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          className={`rounded bg-slate-900 p-2 ${
            t.archived ? "opacity-60 cursor-not-allowed" : ""
          }`}
          value={t.category}
          onChange={(e) =>
            !t.archived && patch({ category: e.target.value as Ticket["category"] })
          }
          disabled={saving || t.archived}
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          className={`rounded bg-slate-900 p-2 ${
            t.archived || !isAdmin ? "opacity-60 cursor-not-allowed" : ""
          }`}
          value={assigneeInput || ""}
          onChange={(e) => {
            if (t.archived || !isAdmin) return;
            const next = e.target.value;
            setAssigneeInput(next);
            void patch({ assignee: next });
          }}
          disabled={saving || t.archived || !isAdmin}
        >
          <option value="">Unassigned</option>
          {assigneeInput &&
            !users.some(
              (u) => u.email === assigneeInput || u.name === assigneeInput
            ) && <option value={assigneeInput}>{assigneeInput}</option>}
          {usersLoading && <option disabled>Loading users…</option>}
          {!usersLoading &&
            users.map((u) => (
              <option key={u._id} value={u.email || u.name}>
                {`${u.name || u.email}${
                  u.email ? ` <${u.email}>` : ""
                }${u.role ? ` (${u.role})` : ""}`}
              </option>
            ))}
        </select>
      </div>

      {/* Description & meta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-xl border border-slate-800 p-4">
          <h2 className="mb-2 font-semibold">Description</h2>
          <textarea
            className={`w-full h-48 resize-vertical rounded-lg border border-slate-700 bg-slate-900 p-3 leading-relaxed ${
              t.archived ? "opacity-60 cursor-not-allowed" : ""
            }`}
            value={desc}
            onChange={(e) => {
              if (!t.archived) {
                setDesc(e.target.value);
                setDescDirty(true);
              }
            }}
            onBlur={() => {
              if (!t.archived && descDirty) void saveDescription();
            }}
            placeholder="Describe the issue…"
            disabled={t.archived}
            readOnly={t.archived}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs opacity-70">
              {t.archived
                ? "Ticket is archived and read-only."
                : `Tip: Press ⌘S / Ctrl+S to save${
                    descDirty ? " • Unsaved changes" : ""
                  }`}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs opacity-70">
                {savingDesc ? "Saving…" : `${desc.length} chars`}
              </span>
              <button
                type="button"
                onClick={saveDescription}
                disabled={t.archived || !descDirty || savingDesc}
                className={`rounded px-3 py-1.5 text-sm transition ${
                  t.archived || !descDirty || savingDesc
                    ? "bg-slate-700 cursor-not-allowed opacity-60"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
                aria-disabled={t.archived || !descDirty || savingDesc}
                title={
                  t.archived
                    ? "Ticket is archived"
                    : descDirty
                    ? "Save description"
                    : "No changes to save"
                }
              >
                {savingDesc ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 p-4">
          <h2 className="mb-2 font-semibold">Details</h2>
          <dl className="space-y-2">
            {meta.map((m) => (
              <div
                key={m.label}
                className="grid grid-cols-[120px_minmax(0,1fr)] gap-2"
              >
                <dt className="text-slate-400">{m.label}</dt>
                <dd className="min-w-0 break-words">{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Comments */}
      <div className="rounded-xl border border-slate-800 p-4">
        <h2 className="mb-3 font-semibold">Comments</h2>

        {cErr && (
          <div className="mb-3 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {cErr}
          </div>
        )}

        <div className="space-y-3 mb-4">
          {loadingComments && <div className="opacity-70">Loading comments…</div>}
          {!loadingComments && comments.length === 0 && (
            <div className="opacity-70">No comments yet.</div>
          )}

          {comments.map((c) => (
            <div key={c._id} className="rounded-lg border border-slate-800 p-3">
              <div className="text-sm text-slate-400 mb-1 flex items-center gap-2">
                <span>{c.author}</span>
                {c.internal && (
                  <span className="rounded bg-amber-800/40 px-2 py-0.5 text-amber-200">
                    Internal
                  </span>
                )}
                <span>• {new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <div className="whitespace-pre-wrap">{c.body}</div>
            </div>
          ))}
        </div>

        <textarea
          className={`w-full rounded bg-slate-900 p-2 ${
            t.archived ? "opacity-60 cursor-not-allowed" : ""
          }`}
          rows={3}
          placeholder={
            t.archived ? "Ticket is archived and read-only" : "Add a comment…"
          }
          value={cBody}
          onChange={(e) => !t.archived && setCBody(e.target.value)}
          disabled={t.archived}
          readOnly={t.archived}
        />
        <div className="mt-2 flex items-center justify-between">
          <label
            className={`flex items-center gap-2 text-sm ${
              t.archived ? "opacity-60" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={cInternal}
              onChange={(e) => !t.archived && setCInternal(e.target.checked)}
              disabled={t.archived}
            />
            Internal note
          </label>
          <button
            onClick={addComment}
            className="rounded px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:opacity-60"
            disabled={t.archived || !cBody.trim()}
            aria-disabled={t.archived || !cBody.trim()}
            title={t.archived ? "Ticket is archived" : (!cBody.trim() ? "Type a comment first" : "Add comment")}
          >
            Add Comment
          </button>
        </div>
      </div>

      {/* Activity / Audit trail */}
      <div className="rounded-xl border border-slate-800 p-4">
        <h2 className="mb-3 font-semibold">Activity</h2>

        {!activityToShow || activityToShow.length === 0 ? (
          <div className="opacity-70 text-sm">No activity yet.</div>
        ) : (
          <ul className="space-y-3">
            {activityToShow.map((a, idx) => {
              const dRaw =
                typeof a.at === "string" ? new Date(a.at) : (a.at as Date);
              const whenText =
                dRaw &&
                typeof (dRaw as any).getTime === "function" &&
                !isNaN(dRaw.getTime())
                  ? dRaw.toLocaleString()
                  : "Just now";
              return (
                <li key={idx} className="rounded-lg border border-slate-800 p-3">
                  <div className="mb-1 text-xs text-slate-400">
                    {whenText} • {a.by || "Unknown user"}
                  </div>
                  <ul className="list-disc pl-5 text-slate-100">
                    {(a.changes && a.changes.length
                      ? a.changes
                      : ["Updated"]
                    ).map((c: string, i: number) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}