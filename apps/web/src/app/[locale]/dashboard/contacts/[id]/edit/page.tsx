'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ContactForm } from '@/components/contacts/contact-form';
import { DataError } from '@/components/data-error';
import { Button } from '@/components/ui';

interface ContactData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  notes: string;
  source: string;
  status: string;
  tagIds: string[];
}

export default function EditContactPage() {
  const params = useParams();
  const contactId = params.id as string;
  const [data, setData] = useState<ContactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadContact = () => {
    setLoadError(null);
    setLoading(true);
    fetch(`/api/contacts/${contactId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Помилка ${res.status}`);
        return res.json();
      })
      .then((d) => {
        const c = d.contact;
        setData({
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          email: c.email || '',
          phone: c.phone || '',
          company: c.company || '',
          position: c.position || '',
          notes: c.notes || '',
          source: c.source || '',
          status: c.status || 'active',
          tagIds: c.tags?.map((t: { tag: { id: string } }) => t.tag.id) || [],
        });
      })
      .catch((err: unknown) => {
        setData(null);
        setLoadError(err instanceof Error ? err.message : 'Помилка завантаження');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadContact();
  }, [contactId]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-96 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        {loadError ? (
          <DataError message={loadError} onRetry={loadContact} />
        ) : (
          <>
            <p className="text-foreground-muted mb-4">Контакт не знайдено</p>
            <Button onClick={() => window.history.back()}>Назад</Button>
          </>
        )}
      </div>
    );
  }

  return <ContactForm contactId={contactId} initialData={data} />;
}
