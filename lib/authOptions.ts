// lib/authOptions.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { dbConnect } from "./db";
import User from "@/models/User";

// Demo fallback (your existing envs)
const DEMO_EMAIL = process.env.DEMO_USER_EMAIL ?? "admin@example.com";
const DEMO_PASS  = process.env.DEMO_USER_PASSWORD ?? "admin123";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = (creds?.email || "").toLowerCase().trim();
        const password = creds?.password || "";

        // 1) Try DB user
        try {
          await dbConnect();
          const user = await User.findOne({ email }).lean();
          if (user && user.passwordHash) {
            const ok = await bcrypt.compare(password, user.passwordHash);
            if (ok) {
              return { id: String(user._id), name: user.name, email: user.email, role: user.role as "admin" | "user" };
            }
          }
        } catch (_) {}

        // 2) Demo fallback admin (useful for local demos)
        if (email === DEMO_EMAIL.toLowerCase() && password === DEMO_PASS) {
          return { id: "demo-admin", name: "Demo Admin", email: DEMO_EMAIL, role: "admin" as const };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // @ts-ignore
        token.role = (user as any).role || token.role || "user";
      }
      return token;
    },
    async session({ session, token }) {
      // @ts-ignore
      session.user = { ...(session.user || {}), role: (token as any).role || "user" };
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};