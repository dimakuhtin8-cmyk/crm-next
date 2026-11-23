'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

import { QuickSelect } from '@/components/quick-create';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from '@/components/ui';
import { parseCsvToRows } from '@/lib/import/parse-csv';

type ImportEntity = 'contact' | 'deal' | 'task';
type ImportMode = 'create' | 'upsert';
type ImportSource = 'file' | 'google';

interface ParsedTable {
  columns: string[];
  rows: Array<Record<string, string>>;
}

interface ImportError {
  row: number;
  message: string;
}

interface ImportReport {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

// Entity fields → translation keys (import namespace). Data-keys pattern.
const fieldLabels: Record<ImportEntity, Record<string, string>> = {
  contact: {
    firstName: 'fields.firstName',
    lastName: 'fields.lastName',
    email: 'fields.email',
    phone: 'fields.phone',
    company: 'fields.company',
    position: 'fields.position',
    notes: 'fields.notes',
    status: 'fields.status',
    externalId: 'fields.externalId',
  },
  deal: {
    title: 'fields.title',
    value: 'fields.value',
    currency: 'fields.currency',
    company: 'fields.company',
    notes: 'fields.notes',
    status: 'fields.status',
    externalId: 'fields.externalId',
  },
  task: {
    title: 'fields.title',
    description: 'fields.description',
    type: 'fields.type',
    status: 'fields.status',
    priority: 'fields.priority',
    dueDate: 'fields.dueDate',
    externalId: 'fields.externalId',
  },
};

const requiredField: Record<ImportEntity, string> = {
  contact: 'firstName',
  deal: 'title',
  task: 'title',
};

// Auto-mapping: column name patterns per entity field (first match wins).
const autoMapPatterns: Record<ImportEntity, Record<string, string[]>> = {
  contact: {
    email: ['email', 'e-mail', 'пошта', 'email_address'],
    phone: ['phone', 'телефон', 'mobile', 'cell'],
    company: ['company', 'компанія', 'organization', 'org'],
    position: ['position', 'посада', 'title', 'job_title', 'role'],
    notes: ['notes', 'note', 'нотатки', 'коментар', 'comment', 'description', 'опис'],
    status: ['status', 'статус'],
    externalId: ['external_id', 'externalid', 'external', 'зовнішній'],
    lastName: ['last_name', 'lastname', 'last', 'прізвище'],
    firstName: ['name', "ім'я", "ім'я", 'first_name', 'firstname', 'first'],
  },
  deal: {
    company: ['company', 'компанія', 'organization', 'org'],
    value: ['value', 'сума', 'вартість', 'amount', 'suma'],
    currency: ['currency', 'валюта', 'curr'],
    notes: ['notes', 'note', 'нотатки', 'коментар', 'comment', 'description', 'опис'],
    status: ['status', 'статус'],
    externalId: ['external_id', 'externalid', 'external', 'зовнішній'],
    title: ['title', 'назва', 'name', 'deal', 'угода', 'subject', 'тема'],
  },
  task: {
    description: ['description', 'опис', 'details', 'деталі'],
    type: ['type', 'тип'],
    status: ['status', 'статус'],
    priority: ['priority', 'пріоритет'],
    dueDate: ['due', 'date', 'дата', 'термін', 'deadline', 'виконання'],
    externalId: ['external_id', 'externalid', 'external', 'зовнішній'],
    title: ['title', 'назва', 'name', 'subject', 'тема'],
  },
};

const listPaths: Record<ImportEntity, string> = {
  contact: '/dashboard/contacts',
  deal: '/dashboard/deals',
  task: '/dashboard/tasks',
};

function autoMapColumns(entity: ImportEntity, columns: string[]): Record<string, string> {
  const patterns = autoMapPatterns[entity];
  const autoMap: Record<string, string> = {};
  for (const header of columns) {
    const lower = header.toLowerCase();
    for (const [field, list] of Object.entries(patterns)) {
      if (autoMap[field]) continue;
      if (list.some((p) => lower.includes(p))) {
        autoMap[field] = header;
        break; // one source column feeds at most one field
      }
    }
  }
  return autoMap;
}

function aoaToTable(aoa: unknown[][]): ParsedTable {
  const nonEmpty = aoa.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (nonEmpty.length === 0) return { columns: [], rows: [] };

  const seen = new Map<string, number>();
  const columns = nonEmpty[0].map((header, index) => {
    let name = String(header ?? '').trim() || `Column ${index + 1}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) name = `${name} (${count + 1})`;
    return name;
  });

  const rows = nonEmpty.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    columns.forEach((column, index) => {
      row[column] = String(cells[index] ?? '').trim();
    });
    return row;
  });

  return { columns, rows };
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('contacts');
  const tImp = useTranslations('import');
  const tCommon = useTranslations('common');

  const [step, setStep] = useState<'source' | 'mapping' | 'result'>('source');
  const [entity, setEntity] = useState<ImportEntity>('contact');
  const [mode, setMode] = useState<ImportMode>('upsert');
  const [source, setSource] = useState<ImportSource>('file');
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleUrl, setGoogleUrl] = useState('');
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportReport | null>(null);

  const entityLabels: Record<ImportEntity, string> = {
    contact: t('title'),
    deal: t('deals'),
    task: t('tasks'),
  };

  const resetToSource = () => {
    setStep('source');
    setTable(null);
    setMapping({});
    setResult(null);
    setSourceError(null);
    setMappingError(null);
    setGoogleUrl('');
  };

  const applyTable = (parsed: ParsedTable) => {
    if (parsed.rows.length === 0) {
      setSourceError(tImp('noDataRows'));
      return;
    }
    setTable(parsed);
    setMapping(autoMapColumns(entity, parsed.columns));
    setMappingError(null);
    setStep('mapping');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceError(null);

    const name = file.name.toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');

    const reader = new FileReader();
    reader.onerror = () => setSourceError(tImp('fileParseError'));
    reader.onload = (event) => {
      try {
        let parsed: ParsedTable;
        if (isExcel) {
          const workbook = XLSX.read(new Uint8Array(event.target?.result as ArrayBuffer), {
            type: 'array',
          });
          const sheetName = workbook.SheetNames[0];
          const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
          parsed = sheet
            ? aoaToTable(
                XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' }),
              )
            : { columns: [], rows: [] };
        } else {
          parsed = parseCsvToRows(event.target?.result as string);
        }
        applyTable(parsed);
      } catch {
        setSourceError(tImp('fileParseError'));
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleGoogleLoad = async () => {
    const url = googleUrl.trim();
    if (!url) {
      setSourceError(tImp('googleLinkRequired'));
      return;
    }
    setGoogleLoading(true);
    setSourceError(null);

    try {
      const res = await fetch('/api/import/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data?.columns) || !Array.isArray(data?.rows)) {
        setSourceError(data?.error || tImp('googleFetchError'));
        return;
      }
      applyTable({
        columns: data.columns as string[],
        rows: data.rows as Array<Record<string, string>>,
      });
    } catch {
      setSourceError(tImp('googleFetchError'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleImport = async () => {
    if (!table) return;
    setImporting(true);
    setMappingError(null);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, mode, mapping, rows: table.rows }),
      });
      const data = await res.json();
      const report = data?.report as ImportReport | undefined;
      if (!res.ok || !report) {
        setMappingError(data?.error || tImp('importFailed'));
        return;
      }
      setResult({
        created: report.created ?? 0,
        updated: report.updated ?? 0,
        skipped: report.skipped ?? 0,
        errors: (report.errors ?? []).map((err: { row: number; message: string }) => ({
          row: err.row,
          message: err.message,
        })),
      });
      setStep('result');
    } catch {
      // збій мережі: лишаємось на кроці маппінгу, кнопка знову активна
      setMappingError(tImp('importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const hasRequiredFields = Boolean(mapping[requiredField[entity]]);
  const pageTitle =
    entity === 'contact'
      ? t('importTitle')
      : entity === 'deal'
        ? tImp('titleDeals')
        : tImp('titleTasks');
  const requiredColumnError =
    entity === 'contact' ? t('importRequiredColumn') : tImp('requiredColumnTitle');
  const importButtonLabel =
    entity === 'contact'
      ? t('importCount', { count: table?.rows.length ?? 0 })
      : entity === 'deal'
        ? tImp('importCountDeals', { count: table?.rows.length ?? 0 })
        : tImp('importCountTasks', { count: table?.rows.length ?? 0 });
  const goToListLabel =
    entity === 'contact'
      ? t('importGoToContacts')
      : entity === 'deal'
        ? tImp('goToDeals')
        : tImp('goToTasks');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          <p className="text-foreground-muted">{t('importDescription')}</p>
        </div>
        <Link href={listPaths[entity]}>
          <Button variant="outline">{tCommon('back')}</Button>
        </Link>
      </div>

      {/* Step 1: Source, entity & mode */}
      {step === 'source' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{tImp('settingsTitle')}</CardTitle>
              <CardDescription>{tImp('entityLabel')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Entity selector */}
              <div className="flex flex-wrap gap-2">
                {(['contact', 'deal', 'task'] as ImportEntity[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEntity(id)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      entity === id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:bg-secondary'
                    }`}
                  >
                    {entityLabels[id]}
                  </button>
                ))}
              </div>

              {/* Mode selector */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{tImp('modeLabel')}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('create')}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      mode === 'create'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:bg-secondary'
                    }`}
                  >
                    {tImp('modeCreate')}
                  </button>
                  <Tooltip content={tImp('modeUpsertHint')} side="bottom">
                    <button
                      type="button"
                      onClick={() => setMode('upsert')}
                      className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        mode === 'upsert'
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-foreground hover:bg-secondary'
                      }`}
                    >
                      {tImp('modeUpsert')}
                      <span aria-hidden="true">ⓘ</span>
                    </button>
                  </Tooltip>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{source === 'file' ? t('importStep1') : tImp('step1Google')}</CardTitle>
              <CardDescription>
                {source === 'file' ? tImp('formats') : tImp('googleHint')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={source}
                onValueChange={(v) => {
                  setSource(v as ImportSource);
                  setSourceError(null);
                }}
              >
                <TabsList>
                  <TabsTrigger value="file">{tImp('sourceFile')}</TabsTrigger>
                  <TabsTrigger value="google">{tImp('sourceGoogle')}</TabsTrigger>
                </TabsList>

                {/* Excel / CSV */}
                <TabsContent value="file">
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => fileRef.current?.click()}
                  >
                    <svg
                      className="h-12 w-12 mx-auto text-foreground-muted mb-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <p className="text-foreground-muted mb-2">{t('importDropHint')}</p>
                    <p className="text-xs text-foreground-muted">{tImp('formatHint')}</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    onChange={handleFile}
                    className="hidden"
                  />
                </TabsContent>

                {/* Google Таблица */}
                <TabsContent value="google">
                  <div className="space-y-3">
                    <label
                      htmlFor="google-sheet-url"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {tImp('googleLinkLabel')}
                    </label>
                    <input
                      id="google-sheet-url"
                      type="url"
                      value={googleUrl}
                      onChange={(e) => setGoogleUrl(e.target.value)}
                      placeholder={tImp('googlePlaceholder')}
                      className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-foreground-muted">{tImp('googleHint')}</p>
                    <Button onClick={handleGoogleLoad} disabled={googleLoading}>
                      {googleLoading ? tImp('googleLoading') : tImp('googleFetch')}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              {sourceError && <p className="text-sm text-destructive pt-3">{sourceError}</p>}
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 2: Mapping */}
      {step === 'mapping' && table && (
        <Card>
          <CardHeader>
            <CardTitle>{t('importStep2')}</CardTitle>
            <CardDescription>{t('importRowsFound', { count: table.rows.length })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preview */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {table.columns.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-foreground-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {table.columns.map((h) => (
                        <td key={h} className="px-3 py-1.5 text-foreground-muted">
                          {row[h] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-foreground-muted">{t('importPreviewHint')}</p>

            {/* Mapping */}
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(fieldLabels[entity]).map(([field, labelKey]) => (
                <div key={field} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tImp(labelKey)}
                  </label>
                  <QuickSelect
                    value={mapping[field] || ''}
                    onChange={(v) => setMapping({ ...mapping, [field]: v })}
                    options={[
                      { id: '', name: t('importSkip') },
                      ...table.columns.map((h) => ({ id: h, name: h })),
                    ]}
                    placeholder={t('importSkip')}
                  />
                </div>
              ))}
            </div>

            {!hasRequiredFields && (
              <p className="text-sm text-destructive">{requiredColumnError}</p>
            )}
            {mappingError && <p className="text-sm text-destructive">{mappingError}</p>}

            <div className="flex gap-3 pt-4">
              <Button onClick={handleImport} disabled={!hasRequiredFields || importing}>
                {importing ? t('importing') : importButtonLabel}
              </Button>
              <Button variant="outline" onClick={resetToSource}>
                {source === 'file' ? t('importUploadAnother') : tImp('googleAnother')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Result */}
      {step === 'result' && result && (
        <Card>
          <CardHeader>
            <CardTitle>{t('importStep3')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-success/10 rounded-lg">
                <p className="text-3xl font-bold text-success">{result.created}</p>
                <p className="text-sm text-foreground-muted">{tImp('resultCreated')}</p>
              </div>
              <div className="p-4 bg-success/10 rounded-lg">
                <p className="text-3xl font-bold text-success">{result.updated}</p>
                <p className="text-sm text-foreground-muted">{tImp('resultUpdated')}</p>
              </div>
              <div className="p-4 bg-warning/10 rounded-lg">
                <p className="text-3xl font-bold text-warning">{result.skipped}</p>
                <p className="text-sm text-foreground-muted">{t('importResultSkipped')}</p>
              </div>
              <div className="p-4 bg-destructive/10 rounded-lg">
                <p className="text-3xl font-bold text-destructive">{result.errors.length}</p>
                <p className="text-sm text-foreground-muted">{t('importResultErrors')}</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('importErrorsTitle')}</p>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-left font-medium text-foreground-muted">
                          {tImp('errorRowHeader')}
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-foreground-muted">
                          {tImp('errorMessageHeader')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="px-3 py-1.5 text-foreground-muted">{err.row}</td>
                          <td className="px-3 py-1.5 text-destructive">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Link href={listPaths[entity]}>
                <Button>{goToListLabel}</Button>
              </Link>
              <Button variant="outline" onClick={resetToSource}>
                {t('importMore')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
