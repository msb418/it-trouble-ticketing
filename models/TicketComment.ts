// models/TicketComment.ts
import { Schema, model, models, Types } from "mongoose";

export interface ITicketComment {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  author: string;            // email or name
  body: string;
  internal: boolean;         // internal note vs public
  createdAt: Date;
  updatedAt: Date;
}

const TicketCommentSchema = new Schema<ITicketComment>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
    author: { type: String, required: true },
    body: { type: String, required: true },
    internal: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const TicketComment =
  models.TicketComment || model<ITicketComment>("TicketComment", TicketCommentSchema);