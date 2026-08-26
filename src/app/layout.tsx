import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { StoreAnalytics } from "@/components/famar/store-analytics";

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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "FAMAR - Joyería y Accesorios de Moda",
    description: "Descubre la mejor colección de joyería y accesorios de moda.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <StoreAnalytics />
      </body>
    </html>
  );
}
