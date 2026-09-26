'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

import { Button, Card, CardContent, Input } from '@/components/ui';
import { Save, FileText, Trash2 } from 'lucide-react';

const KPDocument = dynamic(() => import('@/components/pdf/kp-document').then((m) => m.KPDocument), { ssr: false });
const KPDownloadLink = dynamic(() => import('@/components/pdf/kp-document').then((m) => m.KPDownloadLink), { ssr: false });

interface Product {
  name: string;
  quantity: number;
  price: number;
}

interface Template {
  id: string;
  name: string;
  type: 'kp' | 'contract' | 'invoice';
  content: Record<string, unknown>;
  createdAt: string;
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
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  useEffect(() => {
    fetch('/api/documents/templates')
      .then(r => r.json())
      .then(data => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

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

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    try {
      const res = await fetch('/api/documents/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          type: 'kp',
          content: { title, company, description, products, currency, validUntil, notes },
        }),
      });
      if (res.ok) {
        const { template } = await res.json();
        setTemplates(prev => [...prev, template]);
        setShowSaveTemplate(false);
        setTemplateName('');
      }
    } catch {}
  };

  const handleLoadTemplate = (tpl: Template) => {
    const c = tpl.content as Record<string, string>;
    setTitle(c.title || '');
    setCompany(c.company || '');
    setDescription(c.description || '');
    setProducts((c.products as Product[]) || [{ name: '', quantity: 1, price: 0 }]);
    setCurrency(c.currency || 'UAH');
    setValidUntil(c.validUntil || '');
    setNotes(c.notes || '');
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Видалити шаблон?')) return;
    try {
      await fetch(`/api/documents/templates?id=${id}`, { method: 'DELETE' });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Документи</h1>
          <p className="text-foreground-muted">Створення КП та документів у PDF</p>
        </div>
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Шаблони</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {templates.map((tpl) => (
                <div key={tpl.id} className="flex items-center gap-1 group">
                  <button
                    onClick={() => handleLoadTemplate(tpl)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    {tpl.name}
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    className="p-1 rounded text-foreground-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
            <Button variant="outline" onClick={() => setShowSaveTemplate(!showSaveTemplate)}>
              <Save className="h-4 w-4 mr-1" />
              Зберегти як шаблон
            </Button>
          </div>

          {showSaveTemplate && (
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Назва шаблону"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                  <Button onClick={handleSaveTemplate} disabled={!templateName.trim()}>Зберегти</Button>
                </div>
              </CardContent>
            </Card>
          )}
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
