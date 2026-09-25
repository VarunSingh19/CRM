import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { getChrome } from "@/lib/theme.server";
import { themeAttr } from "@/lib/theme";

// Self-hosted at build time, so there is no runtime call to Google and no
// flash of the fallback face. Lato ships 400 and 700; the stylesheet's 500/600/
// 650 weights resolve to the nearest of those.
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-lato",
});

export const metadata: Metadata = {
  title: "Onference CRM — Content & Commercials Portal",
  description: "Internal content-ops and document portal for Onference TV.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // stamped server-side so the first paint is already in the right theme
  const { theme } = await getChrome();
  return (
    <html lang="en" className={lato.variable} data-theme={themeAttr(theme)}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
