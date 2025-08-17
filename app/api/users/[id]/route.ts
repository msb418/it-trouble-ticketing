// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

function requireAdmin(session: any) {
  const role = (session?.user as any)?.role;
  return role === "admin";
}

// PATCH -> update role or reset password
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;
  const body = await req.json();

  await dbConnect();

  const update: any = {};
  if (body.role) {
    if (!["admin", "user"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    update.role = body.role;
  }
  if (body.password) {
    update.passwordHash = await bcrypt.hash(body.password, 10);
  }

  const doc = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const safe = { _id: String(doc._id), name: doc.name, email: doc.email, role: doc.role, createdAt: doc.createdAt };
  return NextResponse.json({ data: safe });
}

// DELETE -> remove user
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const res = await User.findByIdAndDelete(params.id).lean();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}