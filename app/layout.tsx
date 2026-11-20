import type { Metadata, Viewport } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import { SessionProvider } from '@/lib/use-session';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'LaTeXResume — open-source LaTeX resume builder', template: '%s · LaTeXResume' },
  description:
    'Write your resume in LaTeX with live PDF preview, an AI assistant and a built-in MCP server. MIT licensed — self-host it or deploy to Cloudflare Workers.',
};

export const viewport: Viewport = { themeColor: '#131315', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable} dark`}>
      <body className="font-sans">
        <SessionProvider>{children}</SessionProvider>
        <Toaster richColors position="bottom-right" duration={3500} />
      </body>
    </html>
  );
}
