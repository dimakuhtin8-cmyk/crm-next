import Link from 'next/link';

import { Card } from '@/components/ui';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-primary-light px-4 py-1.5 text-sm font-medium text-primary border border-primary/20">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          AI-Powered CRM
        </div>
        
        {/* Title — solid color, no gradient */}
        <h1 className="text-5xl font-bold tracking-tight text-foreground">
          CRM-Next
        </h1>
        
        {/* Description */}
        <p className="text-lg text-foreground-secondary">
          CRM нового покоління для українського бізнесу. Zero-Touch Auto-Fill, 
          Native Messaging, AI Co-Pilot.
        </p>

        {/* CTA */}
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/uk/auth/login"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-glow hover:bg-primary-hover transition-colors"
          >
            Почати безкоштовно
          </Link>
          <Link
            href="/uk/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-card-hover transition-colors"
          >
            Дивитися демо
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-8">
          <Card className="p-4">
            <div className="text-2xl font-bold text-primary">0$</div>
            <div className="text-xs text-foreground-muted mt-1">Ручного вводу</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-success">24/7</div>
            <div className="text-xs text-foreground-muted mt-1">AI Co-Pilot</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-warning">3</div>
            <div className="text-xs text-foreground-muted mt-1">Месенджери</div>
          </Card>
        </div>
      </div>
    </main>
  );
}