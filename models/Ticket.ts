// models/Ticket.ts
import mongoose, { Schema, models, model } from "mongoose";

export type TicketDoc = {
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  category: "Hardware" | "Software" | "Network" | "Other";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  reporterName: string;
  reporterEmail: string;
  assignee?: string | null;
  createdAt: Date;
  updatedAt: Date;
  audit?: {
    at: Date | string;
    by: string;
    action?: string;
    field?: string;
    from?: unknown;
    to?: unknown;
    change?: string;
    changes?: string[];
  }[];
  archived?: boolean;
  archivedAt?: Date | null;
  archivedBy?: string | null;
};

const AuditEntrySchema = new Schema(
  {
    at: { type: Date, required: true, default: Date.now },
    by: { type: String, required: true },
    action: { type: String, default: "update" },          // e.g., "update", "create"
    // keep legacy summary messages
    changes: { type: [String], default: [] },
    change: { type: String, required: false },
    // granular fields we now persist
    field: { type: String, required: false },
    from: { type: Schema.Types.Mixed, default: null },
    to: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const TicketSchema = new Schema<TicketDoc>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      required: true,
      default: "Low",
    },
    category: {
      type: String,
      enum: ["Hardware", "Software", "Network", "Other"],
      required: true,
      default: "Other",
    },
    status: {
      type: String,
      enum: ["Open", "In Progress", "Resolved", "Closed"],
      required: true,
      default: "Open",
    },
    reporterName: { type: String, required: true },
    reporterEmail: { type: String, required: true },
    assignee: { type: String, default: "" },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: String, default: null },
    audit: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

TicketSchema.index({ archived: 1, updatedAt: -1 });

TicketSchema.methods.isArchived = function (): boolean {
  return !!this.archived;
};

export const Ticket =
  (models.Ticket as mongoose.Model<TicketDoc>) ||
  model<TicketDoc>("Ticket", TicketSchema);