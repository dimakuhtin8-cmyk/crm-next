'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Pipeline { id: string; name: string; stages: Array<{ id: string; name: string }> }
interface Contact { id: string; firstName: string; lastName: string | null; email: string | null }
interface Product { id?: string; name: string; quantity: number; price: number }

interface DealFormProps {
  dealId?: string;
  initialData?: {
    title: string; pipelineId: string; stageId: string; value: string; currency: string;
    probability: string; contactId: string; company: string; expectedCloseDate: string;
    notes: string; products: Product[];
  };
}

export function DealForm({ dealId, initialData }: DealFormProps) {
  const router = useRouter();
  const isEdit = !!dealId;

  const [form, setForm] = useState(initialData || {
    title: '', pipelineId: '', stageId: '', value: '', currency: 'UAH', probability: '50',
    contactId: '', company: '', expectedCloseDate: '', notes: '', products: [] as Product[],
  });
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchPipelines(); fetchContacts(); }, []);

  const fetchPipelines = async () => {
    const res = await fetch('/api/pipelines');
    const data = await res.json();
    setPipelines(data.pipelines || []);
    if (!form.pipelineId && data.pipelines?.length > 0) {
      const p = data.pipelines[0];
      setForm((f) => ({ ...f, pipelineId: p.id, stageId: p.stages?.[0]?.id || '' }));
    }
  };

  const fetchContacts = async () => {
    const res = await fetch('/api/contacts?limit=500');
    const data = await res.json();
    setContacts(data.contacts || []);
  };

  const selectedPipeline = pipelines.find((p) => p.id === form.pipelineId);

  const addProduct = () => setForm({ ...form, products: [...form.products, { name: '', quantity: 1, price: 0 }] });
  const removeProduct = (i: number) => setForm({ ...form, products: form.products.filter((_, idx) => idx !== i) });
  const updateProduct = (i: number, field: string, value: string | number) => {
    const products = [...form.products];
    const p = { ...products[i] } as Record<string, unknown>;
    p[field] = value;
    products[i] = p as unknown as Product;
    setForm({ ...form, products });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const body = {
        ...form,
        value: form.value ? parseFloat(form.value) : null,
        probability: parseInt(form.probability) || 50,
        contactId: form.contactId || null,
        expectedCloseDate: form.expectedCloseDate || null,
        products: form.products.filter((p) => p.name),
      };
      const url = isEdit ? `/api/deals/${dealId}` : '/api/deals';
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(isEdit ? `/dashboard/deals/${dealId}` : '/dashboard/deals');
    } catch (err) { setError(err instanceof Error ? err.message : 'Помилка'); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Редагувати угоду' : 'Нова угода'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>}

            <div className="space-y-2">
              <label className="text-sm font-medium">Назва *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Оренда офісу" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Воронка *</label>
                <select value={form.pipelineId} onChange={(e) => {
                  const p = pipelines.find((p) => p.id === e.target.value);
                  setForm({ ...form, pipelineId: e.target.value, stageId: p?.stages?.[0]?.id || '' });
                }} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Етап *</label>
                <select value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {selectedPipeline?.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Сума</label>
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0" min="0" step="0.01" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Валюта</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="UAH">UAH ₴</option><option value="USD">USD $</option><option value="EUR">EUR €</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ймовірність (%)</label>
                <Input type="number" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} min="0" max="100" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Контакт</label>
                <select value={form.contactId} onChange={(e) => {
                  const c = contacts.find((c) => c.id === e.target.value);
                  setForm({ ...form, contactId: e.target.value, company: c ? (form.company || '') : form.company });
                }} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">— Без контакту —</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName || ''}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Компанія</label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Назва компанії" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Очікуване закриття</label>
              <Input type="date" value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} />
            </div>

            {/* Products */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Продукти</label>
                <Button type="button" variant="outline" size="sm" onClick={addProduct}>+ Додати</Button>
              </div>
              {form.products.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-foreground-muted">
                    <div className="col-span-5">Назва</div><div className="col-span-2">Кількість</div><div className="col-span-3">Ціна</div><div className="col-span-2"></div>
                  </div>
                  {form.products.map((p, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2">
                      <Input className="col-span-5" value={p.name} onChange={(e) => updateProduct(i, 'name', e.target.value)} placeholder="Назва продукту" />
                      <Input className="col-span-2" type="number" value={p.quantity} onChange={(e) => updateProduct(i, 'quantity', parseInt(e.target.value) || 1)} min="1" />
                      <Input className="col-span-3" type="number" value={p.price} onChange={(e) => updateProduct(i, 'price', parseFloat(e.target.value) || 0)} min="0" step="0.01" />
                      <Button type="button" variant="ghost" size="sm" className="col-span-2" onClick={() => removeProduct(i)}>×</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Нотатки</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading}>{loading ? 'Збереження...' : isEdit ? 'Зберегти' : 'Створити угоду'}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Скасувати</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
