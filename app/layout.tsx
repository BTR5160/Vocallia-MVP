import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vocallia MVP',
  description: 'Realtime Tunisian voice agent MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
