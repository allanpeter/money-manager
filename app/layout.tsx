import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { ConsentBanner } from "@/components/ConsentBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://financeiro.apps.allanpimentel.com",
  ),
  title: "Gestor Financeiro — Controle de gastos e metas",
  description:
    "Organize entradas e gastos do mês, veja quanto sobra e distribua o saldo livre entre suas metas. Grátis e sem cadastro.",
  keywords: [
    "controle financeiro",
    "gastos mensais",
    "orçamento",
    "reserva de emergência",
    "finanças pessoais",
  ],
  openGraph: {
    title: "Gestor Financeiro — Controle de gastos e metas",
    description:
      "Organize entradas e gastos do mês, veja quanto sobra e distribua o saldo livre entre suas metas.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <ConsentBanner />
      </body>
    </html>
  );
}
