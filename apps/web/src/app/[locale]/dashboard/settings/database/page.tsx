'use client';

import { useState, useEffect } from 'react';

import { Button, Card, CardContent, Input, Label, Separator } from '@/components/ui';

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
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);
  // Класична форма параметрів з'єднання — збирає databaseUrl на клієнті
  const [dbForm, setDbForm] = useState({ host: '', port: '', user: '', password: '', dbname: '' });

  const schemeFor = (t: DatabaseType) =>
    t === 'postgresql' ? 'postgresql' : t === 'sqlserver' ? 'sqlserver' : 'mysql';
  const defaultPortFor = (t: DatabaseType) =>
    t === 'postgresql' ? '5432' : t === 'sqlserver' ? '1433' : '3306';

  const updateDbField = (field: keyof typeof dbForm, value: string) => {
    const next = { ...dbForm, [field]: value };
    setDbForm(next);
    if (next.host && next.user && next.dbname) {
      const port = next.port || defaultPortFor(selectedType);
      const creds = `${encodeURIComponent(next.user)}:${encodeURIComponent(next.password)}`;
      setDatabaseUrl(`${schemeFor(selectedType)}://${creds}@${next.host}:${port}/${next.dbname}`);
    }
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
    if (!databaseUrl || selectedType === 'shared') return;

    setTesting(true);
    setTestResult(null);
    setMessage('');

    try {
      const res = await fetch('/api/tenant/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseUrl, databaseType: selectedType }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(data.data);
      }
    } catch {
      setTestResult({ success: false, error: "Помилка з'єднання з сервером" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

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
        setMessage('Налаштування збережено');
        setConfig((prev) =>
          prev ? { ...prev, type: data.data.type, status: data.data.status } : null,
        );
      } else {
        setMessage(`Помилка: ${data.error}`);
      }
    } catch {
      setMessage('Помилка збереження');
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
        setMessage('Відключено від зовнішньої бази даних');
        setConfig((prev) => (prev ? { ...prev, type: 'shared', hasExternalDb: false } : null));
      }
    } catch {
      setMessage('Помилка відключення');
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
                    onChange={(e) => updateDbField('port', e.target.value)}
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
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="db-password" className="text-xs text-foreground-muted">
                    Пароль
                  </Label>
                  <Input
                    id="db-password"
                    type="password"
                    placeholder="••••••••"
                    value={dbForm.password}
                    onChange={(e) => updateDbField('password', e.target.value)}
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
                <Button variant="outline" onClick={handleTest} disabled={!databaseUrl || testing}>
                  {testing ? 'Тестування...' : "Тестувати з'єднання"}
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Збереження...' : 'Зберегти'}
                </Button>
                {config?.hasExternalDb && (
                  <Button variant="destructive" onClick={handleDisconnect} disabled={saving}>
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

              {/* Save Message */}
              {message && (
                <div
                  className={`p-4 rounded-lg border ${
                    message.includes('Помилка')
                      ? 'bg-danger/10 border-danger/20 text-danger'
                      : 'bg-success/10 border-success/20 text-success'
                  }`}
                >
                  {message}
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
