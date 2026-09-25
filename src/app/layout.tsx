import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRASIVO — Acompanhe quem representa você",
  description:
    "Plataforma independente para acompanhar informações públicas e verificáveis sobre representantes brasileiros.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
