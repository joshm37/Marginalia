import './globals.css';
import type { Metadata } from 'next';
import { DM_Sans, Libre_Baskerville } from 'next/font/google';
import Script from 'next/script';

const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const serif = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Marginalia',
  description: 'A browser-first research library for policy and legal research.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script id="theme" strategy="beforeInteractive">
          {`try{const saved=localStorage.getItem("rcm-theme");document.documentElement.dataset.theme=saved||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch{}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
