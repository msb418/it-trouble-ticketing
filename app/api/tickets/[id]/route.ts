// app/api/tickets/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/authOptions";
import { dbConnect } from "@/lib/db";
import { Ticket } from "@/models/Ticket";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

function serialize(doc: any) {
  if (!doc) return null;
  const o: any = { ...doc, _id: String(doc._id) };
  if (o.createdAt) o.createdAt = new Date(o.createdAt).toISOString();
  if (o.updatedAt) o.updatedAt = new Date(o.updatedAt).toISOString();
  return o;
}

export async function GET(_req: NextRequest, { params }: { params: { id?: string } }) {
  await dbConnect();
  const id = params?.id;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const doc = await Ticket.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: serialize(doc) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  const id = params?.id;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  // Never allow _id through
  if ("_id" in body) delete body._id;

  // Whitelist fields
  const update: Record<string, unknown> = {};
  if (typeof body.status === "string") update.status = body.status;
  if (typeof body.priority === "string") update.priority = body.priority;
  if (typeof body.category === "string") update.category = body.category;
  if (typeof body.assignee === "string") update.assignee = body.assignee.trim();

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const updated = await Ticket.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(
      { data: serialize(updated) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Validation error" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  const id = params?.id;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const deleted = await Ticket.findByIdAndDelete(id).lean();
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ data: { _id: String(id) } }, { headers: { "Cache-Control": "no-store" } });
}