import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import Navigation from '@/components/Navigation';
import { AuthProvider } from '@/contexts/AuthContext';
import ThemeProvider from '@/components/ThemeProvider';
import Header from '@/components/Header';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "4Minitz 2.0 - Sitzungsprotokoll-Verwaltung",
  description: "4Minitz 2.0 für effiziente Sitzungsprotokoll-Verwaltung",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  // Fetch settings for organization name
  await connectDB();
  const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
  const organizationName = settings?.systemSettings?.organizationName || 'Protokoll-APP';

  return (
    <html lang="en">
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <ThemeProvider>
              <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
                {/* Modern Header with Glassmorphism */}
                <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-lg border-b border-white/20 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-300">
                  <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex justify-between items-center mb-4">
                      <Header />
                    </div>
                    <Navigation />
                  </div>
                </header>

                {/* Main Content with modern spacing */}
                <main className="max-w-7xl mx-auto px-4 py-8">
                  <div className="animate-in fade-in duration-500">
                    {children}
                  </div>
                </main>

                {/* Footer */}
                <footer className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 border-t border-gray-200 dark:border-slate-800 mt-12 transition-colors duration-300">
                  <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="text-center">
                      <p className="text-gray-800 dark:text-gray-200 font-semibold text-lg">{organizationName}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">© Copyright by Bph</p>
                    </div>
                  </div>
                </footer>
              </div>
            </ThemeProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
