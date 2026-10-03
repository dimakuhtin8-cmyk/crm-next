import { Geist, Geist_Mono, Golos_Text, Manrope } from 'next/font/google';

import './globals.css';
import type { Metadata, Viewport } from 'next';

import { ThemeProvider } from '@/components/theme-provider';

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
});

// Akari world: light humanist display + humanist sans body, both with Cyrillic.
const display = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-display',
});

const golos = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-golos',
});

export const metadata: Metadata = {
  title: {
    default: 'CRM-Next',
    template: '%s · CRM-Next',
  },
  description: 'AI-First CRM для України',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} ${display.variable} ${golos.variable} font-sans bg-background text-foreground antialiased`}
        suppressHydrationWarning
      >
        <span
          dangerouslySetInnerHTML={{
            __html: `<!-- THESIS: порядок, видимий одним поглядом; відмова від темного glow-SaaS: жодного неону, скла, градієнтного тексту. OWN-WORLD: тепле washi-папір, бамбукові rib-лінії, вугільне чорнило, одна кіноварна печатка-статус; Manrope display + Golos body, кирилиця. STORY: керівник продажів вірить «порядок без зусиль» і йде в trial; 5 вкладок доводять механіку живою роботою. FIRST VIEWPORT: герой — освітлений обʼєм: жива воронка всередині паперового місяця, первинна дія поруч. FORM: Akari, challenger з ролу, seed key f0bc9ea7, raised слідом руху, станом-світлом, знаком-станом, щільністю, номером-адресою. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md -->`,
          }}
          aria-hidden="true"
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
