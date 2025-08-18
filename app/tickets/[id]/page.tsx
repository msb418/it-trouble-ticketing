// app/tickets/[id]/page.tsx
import TicketDetail from "@/components/TicketDetail";
import { dbConnect } from "@/lib/db";
import { notFound } from "next/navigation";
import { Ticket } from "@/models/Ticket";
import { unstable_noStore as noStore } from "next/cache";

export const revalidate = 0;
export const dynamic = "force-dynamic";

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
  audit?: { at: string | Date; by: string; changes: string[] }[];
};

export default async function TicketPage({
  params,
}: {
  params: { id: string };
}) {
  noStore();
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
    audit: (() => {
      const raw = (doc as any).audit ?? (doc as any).activity ?? [];
      if (!Array.isArray(raw)) return [] as { at: string; by: string; changes: string[] }[];
      return raw.map((a: any) => {
        const at = typeof a.at === "string" ? a.at : new Date(a.at).toISOString();
        const by = a.by || a.user || "";
        // Prefer prebuilt changes array; otherwise synthesize from field/from/to
        let changes: string[] = [];
        if (Array.isArray(a.changes)) {
          changes = a.changes;
        } else if (a.field) {
          const label = String(a.field)
            .replace(/_/g, " ")
            .replace(/^\w/, (c: string) => c.toUpperCase());
          if (a.field === "description") {
            changes = ["Description updated"];
          } else {
            const from = a.from ?? "—";
            const to = a.to ?? "—";
            changes = [`${label}: ${from} → ${to}`];
          }
        }
        return { at, by, changes };
      });
    })(),
  };

  return <TicketDetail ticket={ticket} />;
}