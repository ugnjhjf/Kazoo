import type { Metadata, Viewport } from 'next';
import './globals.css';
import LayoutWrapper from './LayoutWrapper';

export const metadata: Metadata = {
  title: 'KazooTherapy — Oral Muscle Training',
  description: 'KazooTherapy — A rhythm game for Dysphagia oral muscle training using your voice.',
  appleWebApp: { capable: true, statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f5f7ff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body>
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
