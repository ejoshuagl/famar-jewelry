import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./elegance-theme.css";
import { Providers } from "@/components/providers";
import { StoreAnalytics } from "@/components/famar/store-analytics";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://famar-jewelry.vercel.app"),
  title: "FAMAR | Joyería y Accesorios de Moda",
  description:
    "Descubre joyas y accesorios para cada ocasión. Compra en línea con atención personalizada y envíos en Ecuador.",
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
    title: "FAMAR | Joyería y Accesorios de Moda",
    description:
      "Descubre joyas y accesorios para cada ocasión. Compra en línea con atención personalizada y envíos en Ecuador.",
    url: "https://famar-jewelry.vercel.app",
    siteName: "FAMAR",
    locale: "es_EC",
    type: "website",
    images: [
      {
        url: "/famar-social-preview-v2.jpg",
        width: 1200,
        height: 1200,
        alt: "FAMAR - Joyería y accesorios de moda",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FAMAR | Joyería y Accesorios de Moda",
    description:
      "Descubre joyas y accesorios para cada ocasión. Compra en línea con atención personalizada y envíos en Ecuador.",
    images: ["/famar-social-preview-v2.jpg"],
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('famar-site-theme');var d=localStorage.getItem('famar-design-theme');if(t)document.documentElement.dataset.siteTheme=t;if(d)document.documentElement.dataset.designTheme=d}catch(e){}` }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <StoreAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
