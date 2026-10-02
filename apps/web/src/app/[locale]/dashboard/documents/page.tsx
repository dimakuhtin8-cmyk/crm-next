'use client';

import { Save, FileText, Trash2, Plus, X, LayoutGrid, Table2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

import { QuickSelect } from '@/components/quick-create';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui';

const KPDocument = dynamic(() => import('@/components/pdf/kp-document').then((m) => m.KPDocument), {
  ssr: false,
});
const KPDownloadLink = dynamic(
  () => import('@/components/pdf/kp-document').then((m) => m.KPDownloadLink),
  { ssr: false },
);

interface Product {
  name: string;
  quantity: number;
  price: number;
}

// type (не interface) — щоб задовільнити обмеження Table<T extends Record<string, unknown>>
type Template = {
  id: string;
  name: string;
  type: 'kp' | 'contract' | 'invoice';
  content: Record<string, unknown>;
  createdAt: string;
};

type TemplateView = 'grid' | 'table';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  // Виняток Rule 1: чисто презентаційний стан виду списку шаблонів (Сітка/Таблиця),
  // жодних зв'язків з API/логою не має.
  const [templateView, setTemplateView] = useState<TemplateView>('grid');

  const loadTemplates = () => {
    setTemplatesError(null);
    fetch('/api/documents/templates')
      .then((r) => {
        if (!r.ok) throw new Error(`Помилка ${r.status}`);
        return r.json();
      })
      .then((data) => setTemplates(data.templates || []))
      .catch((err: unknown) => {
        setTemplatesError(err instanceof Error ? err.message : 'Помилка завантаження шаблонів');
      });
  };

  useEffect(() => {
    loadTemplates();
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
      if (!res.ok) throw new Error(`Помилка ${res.status}`);
      const { template } = await res.json();
      setTemplates((prev) => [...prev, template]);
      setShowSaveTemplate(false);
      setTemplateName('');
    } catch {
      setTemplatesError('Не вдалося зберегти шаблон. Спробуйте ще раз.');
    }
  };

  const handleLoadTemplate = (tpl: Template) => {
    const c = tpl.content as Record<string, string>;
    setTitle(c.title || '');
    setCompany(c.company || '');
    setDescription(c.description || '');
    setProducts((c.products as unknown as Product[]) || [{ name: '', quantity: 1, price: 0 }]);
    setCurrency(c.currency || 'UAH');
    setValidUntil(c.validUntil || '');
    setNotes(c.notes || '');
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Видалити шаблон?')) return;
    try {
      const res = await fetch(`/api/documents/templates?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Помилка ${res.status}`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setTemplatesError('Не вдалося видалити шаблон. Спробуйте ще раз.');
    }
  };

  const templateColumns = [
    {
      key: 'name',
      header: 'Назва',
      render: (tpl: Template) => (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <span className="font-medium">{tpl.name}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Створено',
      className: 'w-40',
      render: (tpl: Template) => <span className="text-xs">{formatDate(tpl.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (tpl: Template) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-foreground-muted hover:text-danger"
          aria-label={`Видалити шаблон ${tpl.name}`}
          title="Видалити"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteTemplate(tpl.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Документи</h1>
          <p className="text-foreground-muted">Створення КП та документів у PDF</p>
        </div>
      </div>

      {/* Templates error */}
      {templatesError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm">
          <span className="text-danger">{templatesError}</span>
          <Button variant="outline" size="sm" onClick={loadTemplates} className="shrink-0">
            Спробувати ще раз
          </Button>
        </div>
      )}

      {/* Templates: Grid/Table перемикач */}
      {templates.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Шаблони</span>
              <Badge variant="secondary">{templates.length}</Badge>
            </div>
            <Tabs value={templateView} onValueChange={(v) => setTemplateView(v as TemplateView)}>
              <TabsList className="h-8">
                <TabsTrigger value="grid" className="gap-1.5 px-2.5 text-xs">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Сітка
                </TabsTrigger>
                <TabsTrigger value="table" className="gap-1.5 px-2.5 text-xs">
                  <Table2 className="h-3.5 w-3.5" />
                  Таблиця
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {templateView === 'grid' ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl) => (
                <Card
                  key={tpl.id}
                  onClick={() => handleLoadTemplate(tpl)}
                  title="Завантажити шаблон"
                  className="group cursor-pointer p-3 transition-colors hover:border-primary"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{tpl.name}</p>
                      <p className="mt-0.5 text-xs text-foreground-muted">
                        {formatDate(tpl.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-foreground-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={`Видалити шаблон ${tpl.name}`}
                      title="Видалити"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(tpl.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Table
              data={templates}
              columns={templateColumns}
              onRowClick={(tpl) => handleLoadTemplate(tpl)}
              emptyMessage="Немає шаблонів"
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-medium">Комерційна пропозиція</h3>
              <div>
                <Label className="block text-xs font-medium text-foreground-muted">Назва</Label>
                <Input
                  placeholder="Назва послуги/проєкту"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <Label className="block text-xs font-medium text-foreground-muted">Клієнт</Label>
                <Input
                  placeholder="Назва компанії"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div>
                <Label className="block text-xs font-medium text-foreground-muted">Опис</Label>
                <Textarea
                  className="h-20"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Опис послуги або проєкту"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Послуги/Товари</h3>
                <Button variant="outline" size="sm" onClick={addProduct}>
                  <Plus className="h-4 w-4" />
                  Додати
                </Button>
              </div>
              {products.map((p, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input
                    placeholder="Назва"
                    value={p.name}
                    onChange={(e) => updateProduct(i, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Кількість"
                    value={p.quantity}
                    onChange={(e) => updateProduct(i, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-20"
                  />
                  <Input
                    type="number"
                    placeholder="Ціна"
                    value={p.price || ''}
                    onChange={(e) => updateProduct(i, 'price', parseFloat(e.target.value) || 0)}
                    className="w-28"
                  />
                  {products.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-foreground-muted hover:text-danger"
                      aria-label="Видалити позицію"
                      onClick={() => removeProduct(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-sm font-medium">Разом:</span>
                <span className="text-lg font-bold text-primary">
                  {total.toLocaleString('uk')} {currency}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="block text-xs font-medium text-foreground-muted">Валюта</Label>
                  <QuickSelect
                    value={currency}
                    onChange={setCurrency}
                    options={[
                      { id: 'UAH', name: 'UAH ₴' },
                      { id: 'USD', name: 'USD $' },
                      { id: 'EUR', name: 'EUR €' },
                    ]}
                  />
                </div>
                <div>
                  <Label className="block text-xs font-medium text-foreground-muted">
                    Дійсно до
                  </Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="block text-xs font-medium text-foreground-muted">Примітки</Label>
                <Textarea
                  className="h-16"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Додаткові умови, оплата, гарантія..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowPreview(!showPreview)} className="flex-1">
              {showPreview ? 'Приховати попередній перегляд' : 'Попередній перегляд'}
            </Button>
            <KPDownloadLink data={data} />
            <Button variant="outline" onClick={() => setShowSaveTemplate(!showSaveTemplate)}>
              <Save className="h-4 w-4" />
              Зберегти як шаблон
            </Button>
          </div>

          <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Зберегти як шаблон</DialogTitle>
                <DialogDescription>
                  Поточні дані КП збережуться у список шаблонів для повторного використання.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="Назва шаблону"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>
                  Скасувати
                </Button>
                <Button onClick={handleSaveTemplate} disabled={!templateName.trim()}>
                  Зберегти
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
