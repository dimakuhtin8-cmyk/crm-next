'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';

import { AuthProvider } from '@/components/auth/auth-provider';
import { CookieBanner } from '@/components/legal/cookie-banner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <CookieBanner />
        </QueryClientProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
