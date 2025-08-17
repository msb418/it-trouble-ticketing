// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Providers from "./providers";
import HeaderBar from "@/components/HeaderBar";

export const metadata: Metadata = {
  title: "IT Trouble Ticketing",
  description: "Lightweight helpdesk app for creating and tracking IT tickets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        {/* SessionProvider lives inside Providers */}
        <Providers>
          {/* Client header that live-updates with session */}
          <HeaderBar />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}