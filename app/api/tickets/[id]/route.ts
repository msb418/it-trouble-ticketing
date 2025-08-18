import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { authOptions } from "@/lib/authOptions";
import { Ticket } from "@/models/Ticket";

export const dynamic = "force-dynamic";

function startCase(s?: string) {
  return (s ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (m) => m.toUpperCase());
}
function fmt(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await dbConnect();

  const { id } = params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const doc = await Ticket.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const base: any = {
    ...doc,
    _id: (doc as any)._id.toString(),
    createdAt:
      (doc as any).createdAt instanceof Date
        ? (doc as any).createdAt.toISOString()
        : (doc as any).createdAt,
    updatedAt:
      (doc as any).updatedAt instanceof Date
        ? (doc as any).updatedAt.toISOString()
        : (doc as any).updatedAt,
  };

  // Prefer `audit`, fall back to legacy `activity`
  const rawAudit = (doc as any).audit ?? (doc as any).activity ?? [];
  base.audit = Array.isArray(rawAudit)
    ? rawAudit.map((e: any) => {
        const at =
          e.at instanceof Date ? e.at.toISOString() : e.at ?? new Date().toISOString();
        const synthesized =
          e.field && (e.from !== undefined || e.to !== undefined)
            ? [`${startCase(e.field)}: ${fmt(e.from)} → ${fmt(e.to)}`]
            : [];
        return {
          at,
          by: e.by ?? "System",
          field: e.field,
          from: e.from,
          to: e.to,
          changes: Array.isArray(e.changes)
            ? e.changes
            : e.change
            ? [e.change]
            : synthesized,
        };
      })
    : [];

  return NextResponse.json(base, { status: 200 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Parse request body and normalize to a flat update object
  let raw: any;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  let incoming: Record<string, any> = {};
  if (raw && typeof raw === "object") {
    if (typeof raw.field === "string" && "value" in raw) {
      incoming[raw.field] = raw.value;
    } else if (raw.update && typeof raw.update === "object") {
      incoming = { ...raw.update };
    } else {
      incoming = { ...raw };
    }
  }

  const isAdmin = (session.user as any)?.role === "admin";
  const actor = (session.user?.email as string) || (session.user?.name as string) || "unknown";

  // Allow admin to toggle archive via { archive: boolean } OR { archived: boolean }
  const hasArchiveKey = Object.prototype.hasOwnProperty.call(incoming, "archived") ||
                        Object.prototype.hasOwnProperty.call(incoming, "archive");
  const requestedArchiveValueRaw = hasArchiveKey ? (incoming.archived ?? incoming.archive) : undefined;
  const wantsArchiveToggle = isAdmin && typeof requestedArchiveValueRaw === "boolean";

  // Build allowed field set (non-archive fields)
  const allowedForAll = new Set(["status", "priority", "category", "description"]);
  const allowed = new Set([...allowedForAll, ...(isAdmin ? ["assignee"] : [])]);

  const current = await Ticket.findById(id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Enforce read-only when archived (except unarchive by admin)
  if (current.archived) {
    // If trying to unarchive, we allow it; otherwise block other edits
    const onlyArchiveProvided = Object.keys(incoming).every((k) => k === "archive" || k === "archived");
    const isUnarchiving = wantsArchiveToggle && requestedArchiveValueRaw === false;
    if (!isUnarchiving) {
      if (!onlyArchiveProvided) {
        return NextResponse.json(
          { error: "Ticket is archived and read-only. Unarchive to edit." },
          { status: 423 }
        );
      }
    }
  }

  const by = actor;
  const when = new Date();

  // Activity entries we will append
  const activityEntries: Array<{
    at: Date;
    by: string;
    field?: string;
    from?: string;
    to?: string;
    changes: string[];
  }> = [];

  // Handle archive toggle first (admin only)
  if (wantsArchiveToggle) {
    const nextArchived: boolean = !!requestedArchiveValueRaw;
    if (Boolean(current.archived) !== nextArchived) {
      // Record audit line for archive/unarchive
      activityEntries.push({
        at: when,
        by,
        field: "archived",
        from: fmt(current.archived),
        to: fmt(nextArchived),
        changes: [nextArchived ? "Archived ticket" : "Restored from archive"],
      });
      (current as any).archived = nextArchived;
      (current as any).archivedAt = nextArchived ? when : null;
      (current as any).archivedBy = nextArchived ? by : null;
    }
  }

  // Build updates for allowed non-archive fields (skip if archived and not unarchiving)
  const nonArchiveUpdate: Record<string, any> = {};
  for (const [field, newVal] of Object.entries(incoming)) {
    if (field === "archive" || field === "archived") continue; // handled above
    if (!allowed.has(field)) continue;
    const oldVal = (current as any)[field];
    if (oldVal !== newVal) {
      const labelMap: Record<string, string> = {
        status: "Status",
        priority: "Priority",
        category: "Category",
        description: "Description",
        assignee: "Assignee",
      };
      const label = labelMap[field] ?? startCase(field);
      const fromStr = fmt(oldVal);
      const toStr = fmt(newVal);
      activityEntries.push({
        at: when,
        by,
        field,
        from: fromStr,
        to: toStr,
        changes: [`${label}: ${fromStr} → ${toStr}`],
      });
      nonArchiveUpdate[field] = newVal;
    }
  }

  // Apply non-archive updates (if any)
  if (Object.keys(nonArchiveUpdate).length) {
    Object.assign(current as any, nonArchiveUpdate);
  }

  // Ensure audit array exists; migrate from legacy `activity` if present
  const docAny = current as any;
  if (!Array.isArray(docAny.audit)) {
    docAny.audit = Array.isArray(docAny.activity) ? docAny.activity : [];
  }
  if (activityEntries.length) docAny.audit.push(...activityEntries);

  await current.save();

  return NextResponse.json({ ok: true, audit: (current as any).audit ?? [] }, { status: 200 });
}