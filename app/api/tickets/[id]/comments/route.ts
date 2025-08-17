// app/api/tickets/[id]/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { TicketComment } from "@/models/TicketComment";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  await dbConnect();
  const data = await TicketComment.find({ ticketId: params.id }).sort({ createdAt: 1 }).lean();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  await dbConnect();
  const body = await req.json();
  const created = await TicketComment.create({
    ticketId: params.id,
    author: (session.user?.email as string) || "unknown",
    body: body.body,
    internal: !!body.internal
  });
  return NextResponse.json(created, { status: 201 });
}