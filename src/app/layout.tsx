import type { Metadata } from "next";
import "./globals.css";
import { SupportBanner } from "@/components/SupportBanner";
import { SessionTimeout } from "@/components/SessionTimeout";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "Mentalks — Mental Health Support",
  description: "A safe, private space for students to connect with counselors and find mental health support.",
  icons: { icon: "/brain.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ToastProvider>
          <SupportBanner />
          {children}
          <SessionTimeout timeoutMinutes={15} />
        </ToastProvider>
      </body>
    </html>
  );
}
