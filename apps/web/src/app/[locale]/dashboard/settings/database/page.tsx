'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Button } from '@/components/ui';

type DatabaseType = 'shared' | 'postgresql' | 'mysql' | 'mariadb' | 'sqlserver';

interface DatabaseConfig {
  type: DatabaseType;
  status: string;
  lastError: string | null;
  connectedAt: string | null;
  hasExternalDb: boolean;
}

const DB_OPTIONS: { value: DatabaseType; label: string; description: string }[] = [
  { value: 'shared', label: 'Спільна база даних', description: 'Використовувати базу даних CRM-системи' },
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
  const [testResult, setTestResult] = useState<{ success: boolean; version?: string; error?: string } | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/tenant/database')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setConfig(data.data);
          setSelectedType(data.data.type);
        }
      })
      .catch(() => {});
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
      setTestResult({ success: false, error: 'Помилка з\'єднання з сервером' });
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
        setConfig((prev) => prev ? { ...prev, type: data.data.type, status: data.data.status } : null);
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
        setConfig((prev) => prev ? { ...prev, type: 'shared', hasExternalDb: false } : null);
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

      {/* Current Status */}
      {config && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Поточний статус</h3>
                <p className="text-sm text-foreground-muted mt-1">
                  Тип: <span className="font-medium">{DB_OPTIONS.find((o) => o.value === config.type)?.label || config.type}</span>
                </p>
                {config.lastError && (
                  <p className="text-sm text-red-500 mt-1">Помилка: {config.lastError}</p>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                config.type === 'shared'
                  ? 'bg-secondary text-foreground-muted'
                  : config.status === 'active'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {config.type === 'shared' ? 'Спільна' : config.status === 'active' ? 'Підключено' : 'Помилка'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Database Type Selection */}
      <Card>
        <CardContent className="p-6 space-y-4">
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

      {/* Connection URL (for external databases) */}
      {selectedType !== 'shared' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-medium">Строка підключення</h3>
            <p className="text-sm text-foreground-muted">
              {selectedType === 'postgresql' && 'postgresql://user:password@host:5432/database'}
              {selectedType === 'mysql' && 'mysql://user:password@host:3306/database'}
              {selectedType === 'mariadb' && 'mysql://user:password@host:3306/database'}
              {selectedType === 'sqlserver' && 'sqlserver://user:password@host:1433/database'}
            </p>
            <input
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
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={!databaseUrl || testing}
              >
                {testing ? 'Тестування...' : 'Тестувати з\'єднання'}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Збереження...' : 'Зберегти'}
              </Button>
              {config?.hasExternalDb && (
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={saving}
                >
                  Відключити
                </Button>
              )}
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`p-4 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800'
                  : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
              }`}>
                {testResult.success ? (
                  <div>
                    <p className="text-green-700 dark:text-green-400 font-medium">З&apos;єднання успішне!</p>
                    {testResult.version && (
                      <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                        Версія: {testResult.version}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-red-700 dark:text-red-400">{testResult.error}</p>
                )}
              </div>
            )}

            {/* Save Message */}
            {message && (
              <div className={`p-4 rounded-lg ${
                message.includes('Помилка')
                  ? 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 text-red-700 dark:text-red-400'
                  : 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 text-green-700 dark:text-green-400'
              }`}>
                {message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-medium mb-3">Як це працює?</h3>
          <ul className="space-y-2 text-sm text-foreground-muted">
            <li>• <strong>Спільна база</strong> — ваші дані зберігаються в загальній базі CRM-системи</li>
            <li>• <strong>Зовнішня база</strong> — ваші дані зберігаються на вашому сервері</li>
            <li>• Після підключення CRM автоматично створить таблиці у вашій базі</li>
            <li>• Ви можете відключитися від зовнішньої бази в будь-який момент</li>
            <li>• Підтримуються: PostgreSQL, MySQL, MariaDB, MS SQL Server</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
