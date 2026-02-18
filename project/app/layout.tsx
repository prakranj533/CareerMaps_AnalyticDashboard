import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { RegisterSW } from './register-sw';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Career Maps',
  description: 'Advanced analytics platform with intelligent insights and real-time data processing',
  keywords: 'AI, analytics, dashboard, insights, data visualization, machine learning',
  manifest: '/manifest.webmanifest',
  themeColor: '#2563eb',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
    shortcut: '/icons/icon-192.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <div className="relative min-h-screen bg-[color:hsla(var(--background)/1)]">
          <RegisterSW />
          <div className="relative z-10">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
