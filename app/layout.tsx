import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Candour HQ",
  description: "Turn AI drafts into content your brand would actually publish.",
};

import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
