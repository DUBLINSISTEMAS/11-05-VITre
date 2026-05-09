import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { ReactQueryProvider } from "@/providers/react-query";

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

export const metadata: Metadata = {
  title: {
    default: "Vitrê — Catálogo digital com checkout WhatsApp",
    template: "%s · Vitrê",
  },
  description:
    "Crie um catálogo profissional para sua loja em minutos. Foto pelo celular, link único pro WhatsApp, sem mensalidade pra começar.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  applicationName: "Vitrê",
  authors: [{ name: "Vitrê" }],
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/brand/icone-branco.webp",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // sem maximumScale: respeita zoom do usuário (WCAG 2.1 — 1.4.4)
  themeColor: "#1E3FE6",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReactQueryProvider>{children}</ReactQueryProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
