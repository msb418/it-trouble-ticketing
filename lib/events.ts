export function notifyTicketsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("tickets:changed"));
  }
}