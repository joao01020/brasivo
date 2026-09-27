import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRASIVO",
  description:
    "Plataforma independente para acompanhar informações públicas e verificáveis sobre representantes brasileiros.",
  icons: {
    icon: [
      {
        url: "/favicon.png",
        type: "image/png",
        sizes: "250x250",
      },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
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