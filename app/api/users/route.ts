// app/api/users/route.ts
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

// GET /api/users  -> list users (admin only)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await dbConnect();
  const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ data: users });
}

// POST /api/users  -> create user (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, email, role = "user", password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "name, email, password are required" }, { status: 400 });
  }
  if (!["admin", "user"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  await dbConnect();
  const exists = await User.findOne({ email: email.toLowerCase().trim() }).lean();
  if (exists) return NextResponse.json({ error: "Email already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const doc = await User.create({ name, email: email.toLowerCase().trim(), role, passwordHash });

  const safe = { _id: String(doc._id), name: doc.name, email: doc.email, role: doc.role, createdAt: doc.createdAt };
  return NextResponse.json({ data: safe }, { status: 201 });
}