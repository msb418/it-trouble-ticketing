// models/Ticket.ts
import { Schema, model, models } from "mongoose";

const TicketSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, required: true, trim: true, minlength: 5, maxlength: 2000 },
    priority: { type: String, enum: ["Low", "Medium", "High", "Urgent"], default: "Low", index: true },
    category: { type: String, enum: ["Hardware", "Software", "Network", "Other"], default: "Other", index: true },
    status: { type: String, enum: ["Open", "In Progress", "Resolved", "Closed"], default: "Open", index: true },
    reporterName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    reporterEmail: { type: String, required: true, trim: true, match: /.+\@.+\..+/ },
    assignee: { type: String, trim: true, default: "" }, // email of agent/admin
  },
  { timestamps: true }
);

export const Ticket = models.Ticket || model("Ticket", TicketSchema);
export type TicketDoc = InstanceType<typeof Ticket>;