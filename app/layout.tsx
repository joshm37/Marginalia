import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Research & Citation Manager',
  description: 'A browser-first research library for policy and legal research.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
