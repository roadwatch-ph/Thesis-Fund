import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BrowserExtensionErrorGuard } from "@/components/browser-extension-error-guard";
import "./globals.css";

export const metadata: Metadata = {
  title: "GCash Contribution Tracking System",
  description: "Weekly GCash contribution tracker backed by Google Sheets and Google Drive.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <BrowserExtensionErrorGuard />
        {children}
      </body>
    </html>
  );
}
