import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const display = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: "Simulasi OSN AI 2026",
  description:
    "Platform latihan EKKA/OSN AI: materi, simulasi berwaktu, pelacak performa, dan tutor AI.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Simulasi OSN AI 2026",
    description:
      "Persiapan seleksi EKKA dengan mastery tracking & AI challenges.",
    images: ["/hero-atmosphere.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
