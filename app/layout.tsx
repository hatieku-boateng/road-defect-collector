import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope, Space_Grotesk } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const manrope = Manrope({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-body",
});

const spaceGrotesk = Space_Grotesk({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display",
});

// Warm serif used for headlines on the landing page and admin dashboard.
const fraunces = Fraunces({
  display: "swap",
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: {
    default: "Ghana Road Defect Monitoring",
    template: "%s | Ghana Road Defect Monitoring",
  },
  description:
    "A data collection and monitoring platform for identifying road defects across Ghana.",
  applicationName: "Ghana Road Defect Collector",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Road Collector",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: [
      {
        url: "/icons/road-collector-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/road-collector-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf7f0",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      className={`${manrope.variable} ${spaceGrotesk.variable} ${fraunces.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}