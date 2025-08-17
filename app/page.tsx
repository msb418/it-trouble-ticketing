// app/page.tsx
import TicketsTable from "@/components/TicketsTable";
import TicketForm from "@/components/TicketForm";

export default function Home() {
  return (
    <main className="space-y-8 min-w-0">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Helpdesk Tickets</h1>
      </header>
      <TicketForm />
      <section className="rounded-2xl border border-slate-800 p-3 w-full min-w-0 overflow-visible">
        <TicketsTable />
      </section>
    </main>
  );
}