import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import { PwaRegister } from "@/components/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Inter — fonte do CHROME admin (sidebar, topbar, dashboards, tabelas).
// Aplicada APENAS dentro de `.b3-shell` via globals.css. Storefront, auth
// e onboarding continuam Geist (decisão founder 2026-05-26: Geist é
// "fonte de site/marketing" — pesa estranho em densidade utilitária).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mangos Pay — Loja online com checkout WhatsApp",
    template: "%s · Mangos Pay",
  },
  description:
    "Monte sua loja online em minutos. Foto pelo celular, link único pro WhatsApp, sem mensalidade pra começar.",
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  applicationName: "Mangos Pay",
  authors: [{ name: "Mangos Pay" }],
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: { url: "/logos/favicon.svg", type: "image/svg+xml" },
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Mangos Pay",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // sem maximumScale: respeita zoom do usuário (WCAG 2.1 — 1.4.4)
  themeColor: "#1A3A8F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased`}
      >
        {children}
        <Toaster position="top-center" richColors closeButton />
        <PwaRegister />
      </body>
    </html>
  );
}
