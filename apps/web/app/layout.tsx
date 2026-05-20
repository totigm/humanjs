import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { CursorToggle, HumanCursor, HumanCursorProvider } from '../components/motion';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--jetbrains-mono',
  display: 'swap',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://humanjs.dev'),
  title: {
    default: 'HumanJS — Humanize your browser automation',
    template: '%s · HumanJS',
  },
  description:
    'Realistic mouse paths, typing rhythm, reading dwell, and four personalities. Built on Playwright. MIT-licensed.',
  keywords: [
    'browser automation',
    'playwright',
    'humanize',
    'ai agents',
    'qa testing',
    'demo recording',
  ],
  authors: [{ name: 'Gonzalo Muñoz', url: 'https://github.com/totigm' }],
  creator: 'Gonzalo Muñoz',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://humanjs.dev',
    title: 'HumanJS — Humanize your browser automation',
    description: 'Realistic mouse paths, typing rhythm, reading dwell, and four personalities.',
    siteName: 'HumanJS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HumanJS — Humanize your browser automation',
    description: 'Realistic mouse paths, typing rhythm, reading dwell, and four personalities.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#050506',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <HumanCursorProvider>
          {children}
          <HumanCursor />
          <CursorToggle />
        </HumanCursorProvider>
      </body>
    </html>
  );
}
