// app/tickets/[id]/page.tsx
import { dbConnect } from "@/lib/db";
import { Ticket } from "@/models/Ticket";
import TicketDetail from "@/components/TicketDetail";
import { notFound } from "next/navigation";

type Props = { params: { id: string } };

// Define the expected shape of a lean() ticket doc to satisfy TS
type LeanTicketDoc = {
  _id: unknown;
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  category: "Hardware" | "Software" | "Network" | "Other";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  reporterName: string;
  reporterEmail: string;
  assignee?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export default async function TicketPage({ params }: Props) {
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
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };

  return (
    <div className="mx-auto max-w-5xl p-4 min-w-0">
      <div className="rounded-2xl border border-slate-800 p-4 w-full min-w-0 overflow-visible">
        <TicketDetail ticket={ticket} />
      </div>
    </div>
  );
}