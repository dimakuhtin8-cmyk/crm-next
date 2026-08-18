'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface TenantContextValue {
  tenantId: string | null;
  tenantSlug: string | null;
}

const TenantContext = createContext<TenantContextValue>({
  tenantId: null,
  tenantSlug: null,
});

interface TenantProviderProps {
  tenantId: string | null;
  tenantSlug: string | null;
  children: ReactNode;
}

export function TenantProvider({ tenantId, tenantSlug, children }: TenantProviderProps) {
  return (
    <TenantContext.Provider value={{ tenantId, tenantSlug }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

/**
 * Get tenant ID from current context
 * Useful for API calls and data queries
 */
export function getTenantId(): string | null {
  const { tenantId } = useContext(TenantContext);
  return tenantId;
}
