import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
import AdBlockGate from "@/components/AdBlockGate";
import "./globals.css";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "TradePilot Rolimons",
  description:
    "TradePilot Rolimons — rotate and auto-post Rolimons trade ads every 15 minutes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
    >
      <head>
        {/* Raw tag required — next/script becomes a preload and AdSense won't verify */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8413849757808282"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AdBlockGate />
        {children}
      </body>
    </html>
  );
}
