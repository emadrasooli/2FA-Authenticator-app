import "@/styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "University 2FA Auth",
  description: "Email + Passkey authentication for the university portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-muted/30 text-foreground antialiased">{children}</body>
    </html>
  );
}
