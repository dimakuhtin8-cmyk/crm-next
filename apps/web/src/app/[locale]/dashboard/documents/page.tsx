'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

import { Button, Card, CardContent, Input } from '@/components/ui';

const KPDocument = dynamic(() => import('@/components/pdf/kp-document').then((m) => m.KPDocument), { ssr: false });
const KPDownloadLink = dynamic(() => import('@/components/pdf/kp-document').then((m) => m.KPDownloadLink), { ssr: false });

interface Product {
  name: string;
  quantity: number;
  price: number;
}

export default function DocumentsPage() {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [products, setProducts] = useState<Product[]>([{ name: '', quantity: 1, price: 0 }]);
  const [currency, setCurrency] = useState('UAH');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const total = products.reduce((sum, p) => sum + p.price * p.quantity, 0);

  const addProduct = () => setProducts([...products, { name: '', quantity: 1, price: 0 }]);
  const removeProduct = (i: number) => setProducts(products.filter((_, idx) => idx !== i));
  const updateProduct = (i: number, field: keyof Product, value: string | number) => {
    const next = [...products];
    next[i] = { ...next[i], [field]: value };
    setProducts(next);
  };

  const data = {
    title: title || 'Комерційна пропозиція',
    company: company || undefined,
    description: description || undefined,
    products: products.filter((p) => p.name),
    total,
    currency,
    validUntil: validUntil || undefined,
    notes: notes || undefined,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Документи</h1>
          <p className="text-foreground-muted">Створення КП та документів у PDF</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-medium">Комерційна пропозиція</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Назва</label>
                <Input placeholder="Назва послуги/проєкту" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Клієнт</label>
                <Input placeholder="Назва компанії" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Опис</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  className="h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Опис послуги або проєкту" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Послуги/Товари</h3>
                <Button variant="outline" size="sm" onClick={addProduct}>+ Додати</Button>
              </div>
              {products.map((p, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input placeholder="Назва" value={p.name} onChange={(e) => updateProduct(i, 'name', e.target.value)} className="flex-1" />
                  <Input type="number" placeholder="Кількість" value={p.quantity} onChange={(e) => updateProduct(i, 'quantity', parseInt(e.target.value) || 1)} className="w-20" />
                  <Input type="number" placeholder="Ціна" value={p.price || ''} onChange={(e) => updateProduct(i, 'price', parseFloat(e.target.value) || 0)} className="w-28" />
                  {products.length > 1 && (
                    <button onClick={() => removeProduct(i)} className="rounded p-1.5 text-foreground-muted hover:text-danger transition-colors">✕</button>
                  )}
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-sm font-medium">Разом:</span>
                <span className="text-lg font-bold text-primary">{total.toLocaleString('uk')} {currency}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Валюта</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="UAH">UAH ₴</option>
                    <option value="USD">USD $</option>
                    <option value="EUR">EUR €</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Дійсно до</label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Примітки</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="h-16 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Додаткові умови, оплата, гарантія..." />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={() => setShowPreview(!showPreview)} className="flex-1">
              {showPreview ? 'Приховати попередній перегляд' : 'Попередній перегляд'}
            </Button>
            <KPDownloadLink data={data} />
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <Card className="lg:sticky lg:top-6">
            <CardContent className="p-2">
              <div className="h-[600px] overflow-auto bg-white rounded-lg">
                <KPDocument {...data} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
