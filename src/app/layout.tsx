import type { Metadata } from "next";
import { Tajawal, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LanguageProvider } from "@/components/providers/language-provider";
import { AuthProvider } from "@/components/providers/auth-provider";

// Arabic-first legal product — Tajawal for body+display, JetBrains Mono for code.
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

export const metadata: Metadata = {
  title: "Al Mizan Legal Practice — Litigation & Legal Practice System",
  description:
    "Bilingual (Arabic/English) legal practice & litigation management platform for GCC/MENA jurisdictions. Multi-tenant, secure, AI-assisted.",
  keywords: [
    "Al Mizan",
    "Al Mizan Legal Practice",
    "legal practice management",
    "litigation",
    "GCC",
    "MENA",
    "DIFC",
    "ADGM",
    "arbitration",
    "law firm software",
  ],
  authors: [{ name: "Al Mizan Legal Practice" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${tajawal.variable} ${jetbrains.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
