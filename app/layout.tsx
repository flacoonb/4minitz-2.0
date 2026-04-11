import type { Metadata, Viewport } from "next";
import { connection } from 'next/server';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import Navigation from '@/components/Navigation';
import { AuthProvider } from '@/contexts/AuthContext';
import ThemeProvider from '@/components/ThemeProvider';
import BrandThemeProvider from '@/components/BrandThemeProvider';
import Header from '@/components/Header';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { brandVarsToCssBlock, getBrandCssVars, sanitizeBrandColors } from '@/lib/brand-colors';
import "./globals.css";

export const metadata: Metadata = {
  title: "NXTMinutes - Sitzungsprotokoll-Verwaltung",
  description: "NXTMinutes für effiziente Sitzungsprotokoll-Verwaltung",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.ico", "/favicon-32x32.png"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();

  const messages = await getMessages();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const strictStyles = process.env.CSP_STRICT_STYLES === 'true';

  // Fetch settings for organization name
  await connectDB();
  const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
  const organizationName = settings?.systemSettings?.organizationName || 'Protokoll-APP';
  const organizationLogo = settings?.systemSettings?.organizationLogo || undefined;
  const brandColors = sanitizeBrandColors(settings?.systemSettings?.brandColors);
  const brandCssVars = getBrandCssVars(brandColors);
  const brandCssBlock = brandVarsToCssBlock(brandCssVars);

  return (
    <html lang="en">
      <head>
        {strictStyles && nonce ? (
          <style nonce={nonce} dangerouslySetInnerHTML={{ __html: brandCssBlock }} />
        ) : (
          <style dangerouslySetInnerHTML={{ __html: brandCssBlock }} />
        )}
        {nonce ? (
          <script src="/chunk-recovery.js" defer nonce={nonce} />
        ) : (
          <script src="/chunk-recovery.js" defer />
        )}
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <BrandThemeProvider>
              <ThemeProvider>
                <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
                  {/* Modern Header with Glassmorphism */}
                  <header className="app-header-shell shadow-lg sticky top-0 z-50 transition-colors duration-300">
                    <div className="max-w-7xl mx-auto px-4 py-2 md:py-3">
                      <div className="flex justify-between items-center mb-1.5 md:mb-2">
                        <Header
                          initialOrganizationName={organizationName}
                          initialOrganizationLogo={organizationLogo}
                        />
                      </div>
                      <Navigation />
                    </div>
                  </header>

                  {/* Main Content with modern spacing */}
                  <main className="max-w-7xl mx-auto px-4 py-3 sm:py-5">
                    <div className="animate-in fade-in duration-500">
                      {children}
                    </div>
                  </main>

                  {/* Footer */}
                  <footer className="app-footer-shell mt-8 transition-colors duration-300">
                    <div className="max-w-7xl mx-auto px-4 py-4">
                      <div className="text-center">
                        <p className="font-semibold text-base app-brand-footer-org-name">{organizationName}</p>
                        <p className="text-sm mt-1 app-text-muted">© Copyright by Bph</p>
                      </div>
                    </div>
                  </footer>
                </div>
              </ThemeProvider>
            </BrandThemeProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
