import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { CursorToggle, HumanCursor, HumanCursorProvider } from '../components/motion';
import { ScrollPath } from '../components/motion/ScrollPath';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--geist-mono',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--instrument-serif',
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
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
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <body>
        <HumanCursorProvider>
          <ScrollPath />
          {children}
          <HumanCursor />
          <CursorToggle />
        </HumanCursorProvider>
      </body>
    </html>
  );
}
