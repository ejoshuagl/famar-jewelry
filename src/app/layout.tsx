import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FAMAR - Joyería y Accesorios de Moda",
  description:
    "Descubre la mejor colección de joyería y accesorios de moda en FAMAR. Calidad garantizada, envíos a todo el país y precios accesibles.",
  keywords: [
    "FAMAR",
    "joyería",
    "accesorios",
    "moda",
    "collares",
    "pulseras",
    "anillos",
    "aretes",
    "Ecuador",
  ],
  authors: [{ name: "FAMAR" }],
  openGraph: {
    title: "FAMAR - Joyería y Accesorios de Moda",
    description: "Descubre la mejor colección de joyería y accesorios de moda.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}