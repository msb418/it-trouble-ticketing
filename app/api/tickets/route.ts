// app/api/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Ticket } from "@/models/Ticket";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createTicketSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(2000),
  reporterName: z.string().min(2).max(80),
  reporterEmail: z.string().email(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Low"),
  category: z.enum(["Hardware", "Software", "Network", "Other"]).default("Other"),
});

function ciExact(email: string) {
  // escape regex special chars then anchor; case-insensitive
  const esc = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${esc}$`, "i");
}

export async function GET(req: NextRequest) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const priority = (searchParams.get("priority") || "").trim();
  const category = (searchParams.get("category") || "").trim();

  // NEW: secure “my tickets” flag
  const mine = (searchParams.get("mine") || "").trim() === "1";

  // (Backward compat) if someone still sends ?assignee=..., we’ll treat it as a plain filter
  const assigneeParam = (searchParams.get("assignee") || "").trim();

  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "50", 10), 1), 500);

  const filter: Record<string, any> = {};
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { reporterName: { $regex: q, $options: "i" } },
      { reporterEmail: { $regex: q, $options: "i" } },
      { assignee: { $regex: q, $options: "i" } },
    ];
  }
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;

  // Secure “My Tickets”: resolve from session email
  if (mine) {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (email) {
      const or = [{ assignee: ciExact(email) }, { reporterEmail: ciExact(email) }];
      filter.$and = (filter.$and ?? []).concat([{ $or: or }]);
    } else {
      // no session email => nothing matches
      filter.$and = (filter.$and ?? []).concat([{ _id: null }]);
    }
  } else if (assigneeParam) {
    // Old behavior: explicit assignee filter (exact, case-insensitive)
    filter.assignee = ciExact(assigneeParam);
  }

  const total = await Ticket.countDocuments(filter);
  const data = await Ticket.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();

  return NextResponse.json({ data, total, page, pageSize }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache"
    }
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const t = await Ticket.create({
    ...parsed.data,
    status: "Open",
  });

  return NextResponse.json(t, { status: 201 });
}