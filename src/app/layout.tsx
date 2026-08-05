import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SHERQ Talk Roster 2026 | Sandock Austral Shipyards",
  description:
    "SHERQ Department Toolbox Talk Roster Management — Sandock Austral Shipyards. Daily Morning Presentations 07:00–07:30.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-slate-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
