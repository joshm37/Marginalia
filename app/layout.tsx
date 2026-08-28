import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marginalia',
  description: 'A browser-first research library for policy and legal research.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
