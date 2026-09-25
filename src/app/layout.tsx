import type { Metadata } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-7FQWW64Z2Q";

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

const SITE_TITLE = "Simulasi OSN AI 2026 Gratis | Persiapan EKKA";
const SITE_DESCRIPTION =
  "Gratis (Rp0) untuk pelajar Indonesia. Persiapan EKKA/OSN AI 2026: materi silabus 5 area, bank soal, simulasi berwaktu, dan pelacak performa tanpa biaya.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: "Simulasi OSN AI",
  keywords: [
    "simulasi OSN AI",
    "OSN AI 2026",
    "EKKA",
    "gratis",
    "free",
    "pelajar Indonesia",
    "olimpiade sains nasional AI",
    "bank soal OSN AI",
    "tryout OSN AI",
    "persiapan OSN AI",
  ],
  category: "education",
  icons: { icon: "/favicon.svg" },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/hero-atmosphere.png",
        alt: "Simulasi OSN AI 2026 gratis untuk pelajar Indonesia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
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
      <body className="min-h-full">
        {children}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
