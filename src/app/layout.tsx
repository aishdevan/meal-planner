import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TabBar } from "@/components/TabBar";
import { SwRegister } from "@/components/SwRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Devan Family Meals",
  description: "Weekly meal planning, groceries, and lunchboxes for the Devan household",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Meals",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf5ee" },
    { media: "(prefers-color-scheme: dark)", color: "#16100c" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>
          <main className="mx-auto max-w-lg px-4 pb-28 pt-[calc(env(safe-area-inset-top)+12px)]">
            {children}
          </main>
          <TabBar />
          <SwRegister />
        </Providers>
      </body>
    </html>
  );
}
