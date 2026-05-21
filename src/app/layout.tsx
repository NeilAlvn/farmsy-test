import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FavoritesProvider } from "./_components/FavoritesProvider";
import { TripProvider } from "./_components/TripProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Farmsy – Find Local Farms in Netherlands & Belgium",
  description: "Discover 13,000+ local farms, farm shops, and direct-to-consumer food producers in the Netherlands and Belgium.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <TripProvider>
          <FavoritesProvider>{children}</FavoritesProvider>
        </TripProvider>
      </body>
    </html>
  );
}
