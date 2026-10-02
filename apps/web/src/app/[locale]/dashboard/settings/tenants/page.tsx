'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { QuickCreatePopover, QuickTenantForm } from '@/components/quick-create';
import { Badge, Button, Card, CardContent, Skeleton } from '@/components/ui';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo: string | null;
  role: string;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  owner: 'Власник',
  admin: 'Адміністратор',
  member: 'Учасник',
};

const roleVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
};

export default function TenantsListPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick-create popover
  const [quickOpen, setQuickOpen] = useState(false);
  const quickBtnRef = useRef<HTMLButtonElement>(null);

  const handleQuickCreated = () => {
    setQuickOpen(false);
    fetchTenants();
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/tenants');
      const data = await response.json();
      setTenants(data.tenants || []);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Компанії</h1>
          <p className="text-foreground-muted">Управління компаніями та командами</p>
        </div>
        <Button ref={quickBtnRef} onClick={() => setQuickOpen(true)}>
          Створити компанію
        </Button>
        <QuickCreatePopover
          anchorEl={quickBtnRef.current}
          open={quickOpen}
          onClose={() => setQuickOpen(false)}
          title="Нова компанія"
        >
          <QuickTenantForm onCreated={handleQuickCreated} />
        </QuickCreatePopover>
      </div>

      {tenants.length === 0 ? (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardContent className="py-12 text-center">
            <p className="text-foreground-muted mb-4">У вас ще немає компаній</p>
            <Button onClick={() => setQuickOpen(true)}>Створити першу компанію</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tenants.map((tenant) => (
            <Card
              key={tenant.id}
              className="bg-card border-border shadow-sm rounded-xl cursor-pointer hover:bg-card-hover transition-colors"
              onClick={() => router.push(`/dashboard/settings/tenants/${tenant.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">{tenant.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{tenant.name}</h3>
                    <p className="text-sm text-foreground-muted">
                      /{tenant.slug}
                      {tenant.domain && ` · ${tenant.domain}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={roleVariants[tenant.role] || 'outline'}>
                    {roleLabels[tenant.role] || tenant.role}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
