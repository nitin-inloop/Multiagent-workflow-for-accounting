import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono, Public_Sans } from 'next/font/google';
import './globals.css';

/*
 * Three faces, three jobs. Archivo sets headings with the flat, industrial
 * character of a printed form; Public Sans handles reading text; Plex Mono
 * carries every figure, GSTIN and invoice number, where column alignment
 * actually changes how fast an accountant can scan.
 */
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LedgerFlow — invoice inbox',
  description:
    'LedgerFlow reads supplier invoices, validates GST and arithmetic, routes only the exceptions to an accountant, and produces a Tally-ready entry.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${publicSans.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
