// app/api/tickets/bulk-delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { dbConnect } from "@/lib/db";
import { Ticket } from "@/models/Ticket";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = (session.user as any)?.role === "admin";
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { ids?: string[] } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const ids = (body.ids ?? []).filter((id) => mongoose.isValidObjectId(id));
  if (ids.length === 0) return NextResponse.json({ error: "No valid ids provided" }, { status: 400 });

  await dbConnect();
  const res = await Ticket.deleteMany({ _id: { $in: ids } });
  return NextResponse.json({ deleted: res.deletedCount ?? 0 });
}