import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { FavoritesProvider } from "./_components/FavoritesProvider";
import { TripProvider } from "./_components/TripProvider";
import { ToastProvider } from "./_components/ToastProvider";
import BfcacheReload from "./_components/BfcacheReload";
import SessionGuard from "./_components/SessionGuard";
import FeedbackWidget from "./_components/FeedbackWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Farmsy – Discover Local Farms",
  description: "Find verified farms across the Netherlands and Belgium. Discover 13,000+ local farm shops and direct-to-consumer food producers.",
  icons: {
    icon: [
      { url: '/icon', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  },
  openGraph: {
    title: "Farmsy – Discover Local Farms",
    description: "Find verified farms across the Netherlands and Belgium.",
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    siteName: 'Farmsy',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Farmsy – Discover Local Farms",
    description: "Find verified farms across the Netherlands and Belgium.",
    images: ['/opengraph-image'],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <BfcacheReload />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>
            <SessionGuard />
            <TripProvider>
              <FavoritesProvider>
                {children}
                <FeedbackWidget />
              </FavoritesProvider>
            </TripProvider>
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
