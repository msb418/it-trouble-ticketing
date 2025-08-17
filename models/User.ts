// models/User.ts
import mongoose, { Schema, InferSchemaType, model, models } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user", required: true },
  },
  { timestamps: true }
);

export type IUser = InferSchemaType<typeof UserSchema>;
export default (models.User as mongoose.Model<IUser>) || model<IUser>("User", UserSchema);