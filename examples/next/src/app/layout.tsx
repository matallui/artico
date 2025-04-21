import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@rtco/ui/globals.css";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Artico Example",
  description: "Artico: WebRTC made simple",
  icons: "logo.png",
};

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
