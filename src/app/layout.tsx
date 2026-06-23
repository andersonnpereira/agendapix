import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agendou — Agenda, cobrança e WhatsApp automático para autônomos",
  description:
    "Seus clientes agendam pelo link da bio e recebem o Pix pelo WhatsApp automático. Feito para profissionais autônomos brasileiros.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Agendou",
  },
};

export const viewport = {
  themeColor: "#16a34a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>{children}</body>
    </html>
  );
}
