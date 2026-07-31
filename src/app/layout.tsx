import type { Metadata, Viewport } from "next";
import { Tajawal, JetBrains_Mono, Markazi_Text, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LanguageProvider } from "@/components/providers/language-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import ServiceWorkerRegister from "@/components/offline/service-worker-register";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const markazi = Markazi_Text({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-markazi",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://almizan.legalwakeely.com";
const siteName = "Al Mizan Legal Practice";
const title = "Al Mizan Legal Practice — Litigation & Legal Practice System";
const description =
  "Bilingual (Arabic/English) legal practice & litigation management platform for GCC/MENA jurisdictions. Multi-tenant, secure, AI-assisted.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: `%s — ${siteName}` },
  description,
  applicationName: siteName,
  keywords: [
    "Al Mizan", "Al Mizan Legal Practice", "الميزان", "الميزان للممارسة القانونية",
    "legal practice management", "litigation", "GCC", "MENA", "DIFC", "ADGM",
    "arbitration", "law firm software", "AI legal assistant", "Gemini legal drafting",
  ],
  authors: [{ name: siteName, url: SITE_URL }],
  creator: siteName,
  publisher: siteName,
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  alternates: { canonical: SITE_URL, languages: { en: SITE_URL, ar: SITE_URL, "x-default": SITE_URL } },
  icons: {
    icon: [{ url: "/logo-square.svg", type: "image/svg+xml" }],
    shortcut: "/logo-square.svg",
    apple: [{ url: "/logo-square.svg" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_AR"],
    url: SITE_URL,
    siteName,
    title,
    description,
    images: [{ url: "/logo-square.svg", width: 512, height: 512, alt: "Al Mizan Legal Practice — الميزان للممارسة القانونية" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@AlMizanLegal",
    title,
    description,
    images: ["/logo-square.svg"],
  },
  manifest: "/manifest.webmanifest",
  category: "legal",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6f2f6" },
    { media: "(prefers-color-scheme: dark)", color: "#062a36" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LegalService",
              name: siteName,
              alternateName: "الميزان للممارسة القانونية",
              url: SITE_URL,
              logo: `${SITE_URL}/logo-square.svg`,
              image: `${SITE_URL}/logo-square.svg`,
              description,
              areaServed: ["Jordan", "United Arab Emirates", "Saudi Arabia", "Kuwait", "DIFC", "ADGM"],
              serviceType: ["Legal Practice Management", "Litigation", "Arbitration", "Legal Drafting"],
              knowsLanguage: ["ar", "en"],
            }),
          }}
        />
      </head>
      <body className={`${tajawal.variable} ${jetbrains.variable} ${markazi.variable} ${fraunces.variable} antialiased bg-background text-foreground`} suppressHydrationWarning>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              {children}
              <ServiceWorkerRegister />
              <Toaster />
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
