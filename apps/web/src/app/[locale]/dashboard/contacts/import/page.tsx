'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button, Input, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ParsedCSV {
  headers: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
}

const fieldLabels: Record<string, string> = {
  firstName: "Ім'я *",
  lastName: 'Прізвище',
  email: 'Email',
  phone: 'Телефон',
  company: 'Компанія',
  position: 'Посада',
};

const requiredFields = ['firstName'];

export default function ImportContactsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'mapping' | 'result'>('upload');
  const [csvData, setCsvData] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: Array<{ row: number; error: string }>; total: number } | null>(null);

  const parseCSV = (text: string): ParsedCSV => {
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], rows: [], totalRows: 0 };

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || '';
      });
      return row;
    });

    return { headers, rows, totalRows: rows.length };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setCsvData(parsed);

      // Auto-map common column names
      const autoMap: Record<string, string> = {};
      const namePatterns = ['name', "ім'я", 'ім\'я', 'first_name', 'firstname', 'first'];
      const lastPatterns = ['last_name', 'lastname', 'last', 'прізвище'];
      const emailPatterns = ['email', 'e-mail', 'пошта', 'email_address'];
      const phonePatterns = ['phone', 'телефон', 'mobile', 'cell'];
      const companyPatterns = ['company', 'компанія', 'organization', 'org'];
      const positionPatterns = ['position', 'посада', 'title', 'job_title', 'role'];

      for (const header of parsed.headers) {
        const lower = header.toLowerCase();
        if (!autoMap.firstName && namePatterns.some((p) => lower.includes(p))) {
          autoMap.firstName = header;
        }
        if (!autoMap.lastName && lastPatterns.some((p) => lower.includes(p))) {
          autoMap.lastName = header;
        }
        if (!autoMap.email && emailPatterns.some((p) => lower.includes(p))) {
          autoMap.email = header;
        }
        if (!autoMap.phone && phonePatterns.some((p) => lower.includes(p))) {
          autoMap.phone = header;
        }
        if (!autoMap.company && companyPatterns.some((p) => lower.includes(p))) {
          autoMap.company = header;
        }
        if (!autoMap.position && positionPatterns.some((p) => lower.includes(p))) {
          autoMap.position = header;
        }
      }

      setMapping(autoMap);
      setStep('mapping');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData) return;
    setImporting(true);

    try {
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: csvData.rows, mapping }),
      });

      const data = await res.json();
      setResult(data);
      setStep('result');
    } catch {
    } finally {
      setImporting(false);
    }
  };

  const hasRequiredFields = requiredFields.every((f) => mapping[f]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Імпорт контактів</h1>
          <p className="text-foreground-muted">Завантажте CSV файл (amoCRM, Bitrix24, Google Contacts)</p>
        </div>
        <Link href="/dashboard/contacts">
          <Button variant="outline">Назад</Button>
        </Link>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>1. Завантажте файл</CardTitle>
            <CardDescription>Підтримуються формати: .csv, .txt</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <svg className="h-12 w-12 mx-auto text-foreground-muted mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <p className="text-foreground-muted mb-2">Натисніть або перетягніть файл</p>
              <p className="text-xs text-foreground-muted">Формат: CSV (розділювач: кома)</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFile}
              className="hidden"
            />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Mapping */}
      {step === 'mapping' && csvData && (
        <Card>
          <CardHeader>
            <CardTitle>2. Зіставте колонки</CardTitle>
            <CardDescription>
              Знайдено {csvData.totalRows} рядків. Вкажіть, яка колонка відповідає кожному полю.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preview */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {csvData.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-foreground-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.rows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {csvData.headers.map((h) => (
                        <td key={h} className="px-3 py-1.5 text-foreground-muted">{row[h] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-foreground-muted">Попередній перегляд (перші 3 рядки)</p>

            {/* Mapping */}
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(fieldLabels).map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <label className="text-sm font-medium">{label}</label>
                  <select
                    value={mapping[field] || ''}
                    onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Не імпортувати —</option>
                    {csvData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {!hasRequiredFields && (
              <p className="text-sm text-destructive">Потрібно обрати колонку для поля "Ім'я"</p>
            )}

            <div className="flex gap-3 pt-4">
              <Button onClick={handleImport} disabled={!hasRequiredFields || importing}>
                {importing ? 'Імпорт...' : `Імпортувати ${csvData.totalRows} контактів`}
              </Button>
              <Button variant="outline" onClick={() => { setStep('upload'); setCsvData(null); }}>
                Завантажити інший файл
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Result */}
      {step === 'result' && result && (
        <Card>
          <CardHeader>
            <CardTitle>3. Результат імпорту</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-success/10 rounded-lg">
                <p className="text-3xl font-bold text-success">{result.imported}</p>
                <p className="text-sm text-foreground-muted">Імпортовано</p>
              </div>
              <div className="p-4 bg-warning/10 rounded-lg">
                <p className="text-3xl font-bold text-warning">{result.skipped}</p>
                <p className="text-sm text-foreground-muted">Пропущено</p>
              </div>
              <div className="p-4 bg-destructive/10 rounded-lg">
                <p className="text-3xl font-bold text-destructive">{result.errors.length}</p>
                <p className="text-sm text-foreground-muted">Помилок</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Помилки:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">
                      Рядок {err.row}: {err.error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Link href="/dashboard/contacts">
                <Button>Перейти до контактів</Button>
              </Link>
              <Button variant="outline" onClick={() => { setStep('upload'); setCsvData(null); setResult(null); }}>
                Імпортувати ще
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
