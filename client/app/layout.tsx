import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import QueryProvider from "@/shared/components/providers/query-provider";
import { NavigationProgress } from "@/shared/components/navigation-progress";
import { ThemeProvider } from "@/shared/components/providers/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CookieConsent } from "@/features/consent/components/cookie-consent";
import { consentBootScript } from "@/features/consent/lib/consent-boot";
import { sanitizeGtmId } from "@/features/consent/lib/consent";
import Script from "next/script";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: {
    default: "SourceLab",
    template: "%s · SourceLab",
  },
  description: "Chat with your documents",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = sanitizeGtmId(process.env.NEXT_PUBLIC_GTM_ID);

  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        manrope.variable,
        jetbrainsMono.variable,
      )}
      suppressHydrationWarning
    >
      <head>
        <meta name="apple-mobile-web-app-title" content="SourceLab" />
        <meta name="theme-color" content="#18181b" />
        <Script
          id="consent-default"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: consentBootScript(gtmId) }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <TooltipProvider delay={300}>
              <CookieConsent>
                <Toaster>{children}</Toaster>
              </CookieConsent>
              <NavigationProgress />
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
