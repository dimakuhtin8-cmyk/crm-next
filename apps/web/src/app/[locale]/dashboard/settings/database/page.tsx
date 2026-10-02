'use client';

import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { Button, Card, CardContent, Input, Label, SecretInput, Separator } from '@/components/ui';

type DatabaseType = 'shared' | 'postgresql' | 'mysql' | 'mariadb' | 'sqlserver';

interface DatabaseConfig {
  type: DatabaseType;
  status: string;
  lastError: string | null;
  connectedAt: string | null;
  hasExternalDb: boolean;
}

const DB_OPTIONS: { value: DatabaseType; label: string; description: string }[] = [
  {
    value: 'shared',
    label: 'Спільна база даних',
    description: 'Використовувати базу даних CRM-системи',
  },
  { value: 'postgresql', label: 'PostgreSQL', description: 'Підключити власну базу PostgreSQL' },
  { value: 'mysql', label: 'MySQL', description: 'Підключити власну базу MySQL' },
  { value: 'mariadb', label: 'MariaDB', description: 'Підключити власну базу MariaDB' },
  { value: 'sqlserver', label: 'MS SQL Server', description: 'Підключити власну базу SQL Server' },
];

export default function DatabaseSettingsPage() {
  const [config, setConfig] = useState<DatabaseConfig | null>(null);
  const [selectedType, setSelectedType] = useState<DatabaseType>('shared');
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    version?: string;
    error?: string;
  } | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Класична форма параметрів з'єднання — збирає databaseUrl на клієнті
  const [dbForm, setDbForm] = useState({ host: '', port: '', user: '', password: '', dbname: '' });
  const [fieldErrors, setFieldErrors] = useState<{
    host?: string;
    port?: string;
    user?: string;
    dbname?: string;
  }>({});

  const schemeFor = (t: DatabaseType) =>
    t === 'postgresql' ? 'postgresql' : t === 'sqlserver' ? 'sqlserver' : 'mysql';
  const defaultPortFor = (t: DatabaseType) =>
    t === 'postgresql' ? '5432' : t === 'sqlserver' ? '1433' : '3306';

  const updateDbField = (field: keyof typeof dbForm, value: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    const next = { ...dbForm, [field]: value };
    setDbForm(next);
    if (next.host && next.user && next.dbname) {
      const port = next.port || defaultPortFor(selectedType);
      const creds = `${encodeURIComponent(next.user)}:${encodeURIComponent(next.password)}`;
      setDatabaseUrl(`${schemeFor(selectedType)}://${creds}@${next.host}:${port}/${next.dbname}`);
    }
  };

  /** Валідація параметрів з'єднання (класична форма або готовий рядок) */
  const validateForm = (): boolean => {
    const hasAnyField =
      dbForm.host.trim() || dbForm.user.trim() || dbForm.dbname.trim() || dbForm.port.trim();

    if (hasAnyField) {
      const errs: typeof fieldErrors = {};
      const host = dbForm.host.trim();
      if (!host) errs.host = 'Вкажіть хост';
      else if (/\s/.test(host)) errs.host = 'Хост не може містити пробіли';
      if (!dbForm.user.trim()) errs.user = 'Вкажіть користувача';
      if (!dbForm.dbname.trim()) errs.dbname = 'Вкажіть назву бази';
      if (dbForm.port.trim()) {
        const port = Number(dbForm.port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          errs.port = 'Порт: ціле число від 1 до 65535';
        }
      }
      setFieldErrors(errs);
      if (Object.keys(errs).length > 0) {
        toast.error('Перевірте параметри з’єднання', {
          description: 'Заповніть усі обов’язкові поля',
        });
        return false;
      }
      return true;
    }

    // Класична форма порожня — перевіряємо готовий рядок підключення
    const url = databaseUrl.trim();
    if (!url) {
      toast.error('Вкажіть параметри з’єднання або рядок підключення');
      return false;
    }
    if (!/^[a-z][a-z0-9+.-]*:\/\//.test(url)) {
      toast.error('Невірний рядок підключення', {
        description: 'Приклад: postgresql://user:password@host:5432/database',
      });
      return false;
    }
    return true;
  };

  useEffect(() => {
    fetch('/api/tenant/database')
      .then((r) => {
        if (!r.ok) throw new Error(`Помилка ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data.success) {
          setConfig(data.data);
          setSelectedType(data.data.type);
        }
      })
      .catch(() => {
        // конфіг просто не підвантажиться — форма працює з дефолтами
        setLoadError(true);
      });
  }, []);

  const handleTest = async () => {
    if (selectedType === 'shared') return;
    if (!validateForm()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/tenant/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseUrl, databaseType: selectedType }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(data.data);
        toast.success('З’єднання успішне', {
          description: data.data?.version ? `Версія: ${data.data.version}` : undefined,
        });
      } else {
        const msg = data.error || 'Тест з’єднання не пройшов';
        setTestResult({ success: false, error: msg });
        toast.error('Тест з’єднання не пройшов', { description: msg });
      }
    } catch {
      setTestResult({ success: false, error: "Помилка з'єднання з сервером" });
      toast.error('Тест з’єднання не пройшов', { description: "Помилка з'єднання з сервером" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (selectedType !== 'shared' && !validateForm()) return;

    setSaving(true);

    try {
      const res = await fetch('/api/tenant/database', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseType: selectedType,
          databaseUrl: selectedType === 'shared' ? '' : databaseUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Налаштування збережено');
        setConfig((prev) =>
          prev ? { ...prev, type: data.data.type, status: data.data.status } : null,
        );
      } else {
        toast.error('Не вдалося зберегти', { description: data.error });
      }
    } catch {
      toast.error('Помилка збереження', { description: "Помилка з'єднання з сервером" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/tenant/database', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseType: 'shared', databaseUrl: '' }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedType('shared');
        setDatabaseUrl('');
        toast.success('Відключено від зовнішньої бази даних');
        setConfig((prev) => (prev ? { ...prev, type: 'shared', hasExternalDb: false } : null));
      } else {
        toast.error('Не вдалося відключити', { description: data.error });
      }
    } catch {
      toast.error('Помилка відключення', { description: "Помилка з'єднання з сервером" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">База даних</h1>
        <p className="text-foreground-muted">
          Підключіть власну базу даних для зберігання даних вашої компанії
        </p>
      </div>

      {loadError && (
        <p className="text-sm text-danger">
          Не вдалося завантажити поточний конфіг — показано значення за замовчуванням
        </p>
      )}

      {/* Current Status */}
      {config && (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Поточний статус</h3>
                <p className="text-sm text-foreground-muted mt-1">
                  Тип:{' '}
                  <span className="font-medium">
                    {DB_OPTIONS.find((o) => o.value === config.type)?.label || config.type}
                  </span>
                </p>
                {config.lastError && (
                  <p className="text-sm text-danger mt-1">Помилка: {config.lastError}</p>
                )}
              </div>
              {config.type === 'shared' ? (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-secondary text-foreground-muted">
                  Спільна
                </span>
              ) : config.status === 'active' ? (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-success/10 text-success">
                  Підключено
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-danger/10 text-danger">
                  Помилка
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Database Type Selection */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-5 space-y-4">
          <h3 className="font-medium">Тип бази даних</h3>
          <div className="grid gap-3">
            {DB_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedType === option.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-border-hover'
                }`}
              >
                <input
                  type="radio"
                  name="databaseType"
                  value={option.value}
                  checked={selectedType === option.value}
                  onChange={(e) => setSelectedType(e.target.value as DatabaseType)}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium">{option.label}</p>
                  <p className="text-sm text-foreground-muted">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Connection (for external databases) */}
      {selectedType !== 'shared' && (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardContent className="space-y-5">
            {/* Classic field form (ТЗ): Host, Port, User, Password, DB Name */}
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Параметри з&apos;єднання</h3>
                <p className="text-sm text-foreground-muted">
                  Заповніть хост, користувача та назву бази — CRM збере рядок підключення
                  автоматично
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="db-host" className="text-xs text-foreground-muted">
                    Хост (Host)
                  </Label>
                  <Input
                    id="db-host"
                    placeholder="db.example.com"
                    value={dbForm.host}
                    onChange={(e) => updateDbField('host', e.target.value)}
                    error={fieldErrors.host}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="db-port" className="text-xs text-foreground-muted">
                    Порт
                  </Label>
                  <Input
                    id="db-port"
                    inputMode="numeric"
                    placeholder={defaultPortFor(selectedType)}
                    value={dbForm.port}
                    onChange={(e) => updateDbField('port', e.target.value.replace(/\D/g, ''))}
                    error={fieldErrors.port}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="db-name" className="text-xs text-foreground-muted">
                    Назва бази
                  </Label>
                  <Input
                    id="db-name"
                    placeholder="mydb"
                    value={dbForm.dbname}
                    onChange={(e) => updateDbField('dbname', e.target.value)}
                    error={fieldErrors.dbname}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="db-user" className="text-xs text-foreground-muted">
                    Користувач
                  </Label>
                  <Input
                    id="db-user"
                    placeholder="crm_user"
                    value={dbForm.user}
                    onChange={(e) => updateDbField('user', e.target.value)}
                    error={fieldErrors.user}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="db-password" className="text-xs text-foreground-muted">
                    Пароль
                  </Label>
                  <SecretInput
                    id="db-password"
                    placeholder="••••••••"
                    value={dbForm.password}
                    onChange={(e) => updateDbField('password', e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Manual connection string */}
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Або готовий рядок підключення</h3>
                <p className="text-sm text-foreground-muted">
                  {selectedType === 'postgresql' && 'postgresql://user:password@host:5432/database'}
                  {selectedType === 'mysql' && 'mysql://user:password@host:3306/database'}
                  {selectedType === 'mariadb' && 'mysql://user:password@host:3306/database'}
                  {selectedType === 'sqlserver' && 'sqlserver://user:password@host:1433/database'}
                </p>
              </div>
              <Input
                type="text"
                value={databaseUrl}
                onChange={(e) => setDatabaseUrl(e.target.value)}
                placeholder={
                  selectedType === 'postgresql'
                    ? 'postgresql://user:password@localhost:5432/mydb'
                    : selectedType === 'mysql' || selectedType === 'mariadb'
                      ? 'mysql://user:password@localhost:3306/mydb'
                      : 'sqlserver://user:password@localhost:1433/mydb'
                }
                className="font-mono text-sm"
              />

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleTest} disabled={testing}>
                  {testing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {testing ? 'Тестування...' : "Тестувати з'єднання"}
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {saving ? 'Збереження...' : 'Зберегти'}
                </Button>
                {config?.hasExternalDb && (
                  <Button variant="destructive" onClick={handleDisconnect} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Відключити
                  </Button>
                )}
              </div>

              {/* Test Result */}
              {testResult && (
                <div
                  className={`p-4 rounded-lg border ${
                    testResult.success
                      ? 'bg-success/10 border-success/20'
                      : 'bg-danger/10 border-danger/20'
                  }`}
                >
                  {testResult.success ? (
                    <div>
                      <p className="text-success font-medium">З&apos;єднання успішне!</p>
                      {testResult.version && (
                        <p className="text-sm text-success mt-1">Версія: {testResult.version}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-danger">{testResult.error}</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-5">
          <h3 className="font-medium mb-3">Як це працює?</h3>
          <ul className="space-y-2 text-sm text-foreground-muted">
            <li>
              • <strong>Спільна база</strong> — ваші дані зберігаються в загальній базі CRM-системи
            </li>
            <li>
              • <strong>Зовнішня база</strong> — ваші дані зберігаються на вашому сервері
            </li>
            <li>• Після підключення CRM автоматично створить таблиці у вашій базі</li>
            <li>• Ви можете відключитися від зовнішньої бази в будь-який момент</li>
            <li>• Підтримуються: PostgreSQL, MySQL, MariaDB, MS SQL Server</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
