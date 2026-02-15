import type { Metadata } from "next";
import { Outfit, DM_Sans } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Friend Place",
  description: "Place your friends on alignment charts. Think Wordle meets Wavelength.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${outfit.variable} ${dmSans.variable} antialiased flex flex-col h-dvh`}
      >
        <header data-global-header className="shrink-0 py-3 flex items-center justify-center border-b border-black/5 bg-surface">
          <h1 className="text-xl font-bold text-foreground font-display tracking-tight">
            FriendPlace
          </h1>
        </header>
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
