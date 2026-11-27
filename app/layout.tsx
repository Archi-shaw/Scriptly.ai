import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// Every page is rendered per request so it carries that request's CSP nonce
// (see middleware.ts). Statically prerendered HTML would have no nonce and its
// inline scripts would be blocked.
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  title: {
    default: "Scriptly.ai — AI content generator for blogs, ads, emails & scripts",
    template: "%s · Scriptly.ai",
  },
  description:
    "Scriptly.ai turns a few details into publish-ready blog posts, ad copy, emails, product descriptions and video scripts — in 30+ languages, with AIDA, PAS and BAB frameworks.",
  openGraph: {
    title: "Scriptly.ai — AI content generator",
    description: "Generate high-quality content, copy and scripts with AI in seconds.",
    images: ["/logo-mark.png"],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#09080f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
