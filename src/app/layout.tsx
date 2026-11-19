import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import "@/components/arc/foundation.css";
import "./globals.css";
import { Providers } from "./providers";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Team tracker", template: "%s · Team tracker" },
  description: "Tasks, attendance, leave and utilization for your teams.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${inter.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
