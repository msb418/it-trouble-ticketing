// components/TicketDetail.tsx
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

  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [cBody, setCBody] = useState("");
  const [cInternal, setCInternal] = useState(false);
  const [cErr, setCErr] = useState<string | null>(null);

  // Description edit state
  const [desc, setDesc] = useState(ticket.description);
  const [savingDesc, setSavingDesc] = useState(false);
  const [descDirty, setDescDirty] = useState(false);

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
      const payload = await res.json().catch(() => null);
      const updated = (payload && (payload.data || payload)) as Ticket | null;
      if (updated) {
        setT(updated);
        // keep assignee input in sync
        setAssigneeInput(updated.assignee || "");
        // let the listing know something changed
        try { window.dispatchEvent(new Event("tickets:changed")); } catch {}
      }
    } catch (e: any) {
      alert(e?.message || "Failed to save");
      // Reload to reconcile UI with server if something went wrong
      location.reload();
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
    setCErr(null);
    if (!cBody.trim()) {
      setCErr("Comment cannot be empty.");
      return;
    }
    try {
      const res = await fetch(`/api/tickets/${idRef.current}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: cBody, internal: cInternal }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => "Failed to add comment"));
      setCBody("");
      setCInternal(false);
      await loadComments();
    } catch (e: any) {
      setCErr(e?.message || "Failed to add comment");
    }
  }

  async function saveAssignee() {
    const next = assigneeInput.trim();
    if ((t.assignee || "") === next) return; // nothing to do
    await patch({ assignee: next });
  }

  async function saveDescription() {
    const next = desc.trim();
    if (next === t.description) {
      setDescDirty(false);
      return;
    }
    setSavingDesc(true);
    try {
      setDesc(next); // keep local in sync
      await patch({ description: next });
      setDescDirty(false);
    } catch {
      // patch() already alerts & reloads on fatal error
    } finally {
      setSavingDesc(false);
    }
  }

  useEffect(() => {
    loadComments();
    setAssigneeInput(ticket.assignee || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save description with Cmd/Ctrl+S
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

  const meta = useMemo(
    () => [
      { label: "Reporter", value: `${t.reporterName} <${t.reporterEmail}>` },
      { label: "Assignee", value: t.assignee || "—" },
      { label: "Created", value: new Date(t.createdAt).toLocaleString() },
      { label: "Updated", value: new Date(t.updatedAt).toLocaleString() },
    ],
    [t]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <Link href="/" className="rounded bg-slate-700 px-3 py-1.5">Back</Link>
      </div>

      {/* Quick edit bar */}
      <div className="rounded-xl border border-slate-800 p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
        <select
          className="rounded bg-slate-900 p-2"
          value={t.status}
          onChange={(e) => patch({ status: e.target.value as Ticket["status"] })}
          disabled={saving}
        >
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          className="rounded bg-slate-900 p-2"
          value={t.priority}
          onChange={(e) => patch({ priority: e.target.value as Ticket["priority"] })}
          disabled={saving}
        >
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select
          className="rounded bg-slate-900 p-2"
          value={t.category}
          onChange={(e) => patch({ category: e.target.value as Ticket["category"] })}
          disabled={saving}
        >
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input
          className={`rounded bg-slate-900 p-2 ${!isAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
          placeholder="Assignee (optional)"
          value={assigneeInput}
          onChange={(e) => setAssigneeInput(e.target.value)}
          onBlur={isAdmin ? saveAssignee : undefined}
          onKeyDown={(e) => {
            if (isAdmin && e.key === "Enter") {
              e.currentTarget.blur(); // triggers onBlur -> save
            }
          }}
          readOnly={!isAdmin}
          disabled={saving || !isAdmin}
          aria-readonly={!isAdmin}
        />
      </div>

      {/* Description & meta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-xl border border-slate-800 p-4">
          <h2 className="mb-2 font-semibold">Description</h2>
          <textarea
            className="w-full h-48 resize-vertical rounded-lg border border-slate-700 bg-slate-900 p-3 leading-relaxed"
            value={desc}
            onChange={(e) => { setDesc(e.target.value); setDescDirty(true); }}
            onBlur={() => { if (descDirty) void saveDescription(); }}
            placeholder="Describe the issue…"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs opacity-70">
              Tip: Press ⌘S / Ctrl+S to save{descDirty ? " • Unsaved changes" : ""}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs opacity-70">{savingDesc ? "Saving…" : `${desc.length} chars`}</span>
              <button
                type="button"
                onClick={saveDescription}
                disabled={!descDirty || savingDesc}
                className={`rounded px-3 py-1.5 text-sm transition
                  ${(!descDirty || savingDesc) ? "bg-slate-700 cursor-not-allowed opacity-60" : "bg-emerald-600 hover:bg-emerald-500"}`}
                aria-disabled={!descDirty || savingDesc}
                title={descDirty ? "Save description" : "No changes to save"}
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
              <div key={m.label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
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

        {cErr && <div className="mb-3 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{cErr}</div>}

        <div className="space-y-3 mb-4">
          {loadingComments && <div className="opacity-70">Loading comments…</div>}
          {!loadingComments && comments.length === 0 && <div className="opacity-70">No comments yet.</div>}

          {comments.map((c) => (
            <div key={c._id} className="rounded-lg border border-slate-800 p-3">
              <div className="text-sm text-slate-400 mb-1 flex items-center gap-2">
                <span>{c.author}</span>
                {c.internal && <span className="rounded bg-amber-800/40 px-2 py-0.5 text-amber-200">Internal</span>}
                <span>• {new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <div className="whitespace-pre-wrap">{c.body}</div>
            </div>
          ))}
        </div>

        <textarea
          className="w-full rounded bg-slate-900 p-2"
          rows={3}
          placeholder="Add a comment…"
          value={cBody}
          onChange={(e) => setCBody(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cInternal} onChange={(e) => setCInternal(e.target.checked)} />
            Internal note
          </label>
          <button onClick={addComment} className="rounded bg-emerald-600 px-3 py-1.5">Add Comment</button>
        </div>
      </div>
    </div>
  );
}