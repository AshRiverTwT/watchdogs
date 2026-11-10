import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "watchdogs",
  description: "Get one email when your show opens for booking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bai+Jamjuree:ital,wght@0,700;1,700&family=Space+Grotesk:wght@400;500;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
