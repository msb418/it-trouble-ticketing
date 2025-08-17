// app/tickets/[id]/page.tsx
import TicketDetail from "@/components/TicketDetail";
import { dbConnect } from "@/lib/db";
import { notFound } from "next/navigation";
import { Ticket } from "@/models/Ticket";

// A typed shape for the result of .lean()
type LeanTicketDoc = {
  _id: string;
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  category: "Hardware" | "Software" | "Network" | "Other";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  reporterName: string;
  reporterEmail: string;
  assignee?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export default async function TicketPage({
  params,
}: {
  params: { id: string };
}) {
  await dbConnect();

  // Use a typed lean() so TS knows the fields on the returned object
  const doc = await Ticket.findById(params.id).lean<LeanTicketDoc>();
  if (!doc) return notFound();

  const ticket = {
    _id: String(doc._id),
    title: doc.title,
    description: doc.description,
    priority: doc.priority,
    category: doc.category,
    status: doc.status,
    reporterName: doc.reporterName,
    reporterEmail: doc.reporterEmail,
    assignee: doc.assignee ?? "",
    createdAt:
      typeof doc.createdAt === "string"
        ? doc.createdAt
        : new Date(doc.createdAt).toISOString(),
    updatedAt:
      typeof doc.updatedAt === "string"
        ? doc.updatedAt
        : new Date(doc.updatedAt).toISOString(),
  };

  return <TicketDetail ticket={ticket} />;
}