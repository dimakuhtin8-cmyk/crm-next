'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
    label: 'settings.dbSharedLabel',
    description: 'settings.dbSharedDescription',
  },
  {
    value: 'postgresql',
    label: 'settings.dbPostgresqlLabel',
    description: 'settings.dbPostgresqlDescription',
  },
  { value: 'mysql', label: 'settings.dbMysqlLabel', description: 'settings.dbMysqlDescription' },
  {
    value: 'mariadb',
    label: 'settings.dbMariadbLabel',
    description: 'settings.dbMariadbDescription',
  },
  {
    value: 'sqlserver',
    label: 'settings.dbSqlserverLabel',
    description: 'settings.dbSqlserverDescription',
  },
];

export default function DatabaseSettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
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
  const optionLabel = (type: string) => {
    const option = DB_OPTIONS.find((o) => o.value === type);
    return option ? t(option.label) : type;
  };

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
      if (!host) errs.host = t('dbHostRequired');
      else if (/\s/.test(host)) errs.host = t('dbHostSpaces');
      if (!dbForm.user.trim()) errs.user = t('dbUserRequired');
      if (!dbForm.dbname.trim()) errs.dbname = t('dbNameRequired');
      if (dbForm.port.trim()) {
        const port = Number(dbForm.port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          errs.port = t('dbPortInvalid');
        }
      }
      setFieldErrors(errs);
      if (Object.keys(errs).length > 0) {
        toast.error(t('dbCheckParams'), {
          description: t('dbFillRequired'),
        });
        return false;
      }
      return true;
    }

    // Класична форма порожня — перевіряємо готовий рядок підключення
    const url = databaseUrl.trim();
    if (!url) {
      toast.error(t('dbProvideConnection'));
      return false;
    }
    if (!/^[a-z][a-z0-9+.-]*:\/\//.test(url)) {
      toast.error(t('dbInvalidUrl'), {
        description: t('dbUrlExample'),
      });
      return false;
    }
    return true;
  };

  useEffect(() => {
    fetch('/api/tenant/database')
      .then((r) => {
        if (!r.ok) throw new Error(tCommon('errors.requestStatus', { status: r.status }));
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
        toast.success(t('dbTestSuccess'), {
          description: data.data?.version
            ? t('dbVersion', { version: data.data.version })
            : undefined,
        });
      } else {
        const msg = data.error || t('dbTestFailed');
        setTestResult({ success: false, error: msg });
        toast.error(t('dbTestFailed'), { description: msg });
      }
    } catch {
      setTestResult({ success: false, error: tCommon('serverConnectionError') });
      toast.error(t('dbTestFailed'), { description: tCommon('serverConnectionError') });
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
        toast.success(t('settingsSaved'));
        setConfig((prev) =>
          prev ? { ...prev, type: data.data.type, status: data.data.status } : null,
        );
      } else {
        toast.error(t('dbSaveFailed'), { description: data.error });
      }
    } catch {
      toast.error(tCommon('saveError'), { description: tCommon('serverConnectionError') });
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
        toast.success(t('dbDisconnectedSuccess'));
        setConfig((prev) => (prev ? { ...prev, type: 'shared', hasExternalDb: false } : null));
      } else {
        toast.error(t('dbDisconnectFailed'), { description: data.error });
      }
    } catch {
      toast.error(tCommon('disconnectError'), { description: tCommon('serverConnectionError') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('databaseCardTitle')}</h1>
        <p className="text-foreground-muted">{t('dbPageDescription')}</p>
      </div>

      {loadError && <p className="text-sm text-danger">{t('dbConfigLoadError')}</p>}

      {/* Current Status */}
      {config && (
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{t('dbCurrentStatus')}</h3>
                <p className="text-sm text-foreground-muted mt-1">
                  {t('dbTypeLabel')} <span className="font-medium">{optionLabel(config.type)}</span>
                </p>
                {config.lastError && (
                  <p className="text-sm text-danger mt-1">
                    {t('dbErrorLabel', { message: config.lastError })}
                  </p>
                )}
              </div>
              {config.type === 'shared' ? (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-secondary text-foreground-muted">
                  {t('dbStatusShared')}
                </span>
              ) : config.status === 'active' ? (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-success/10 text-success">
                  {t('connected')}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-danger/10 text-danger">
                  {tCommon('error')}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Database Type Selection */}
      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardContent className="p-5 space-y-4">
          <h3 className="font-medium">{t('dbTypeTitle')}</h3>
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
                  <p className="font-medium">{t(option.label)}</p>
                  <p className="text-sm text-foreground-muted">{t(option.description)}</p>
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
                <h3 className="font-medium">{t('dbConnectionParams')}</h3>
                <p className="text-sm text-foreground-muted">{t('dbConnectionParamsHint')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="db-host" className="text-xs text-foreground-muted">
                    {t('dbHostLabel')}
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
                    {t('dbPortLabel')}
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
                    {t('dbNameLabel')}
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
                    {t('dbUserLabel')}
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
                    {t('dbPasswordLabel')}
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
                <h3 className="font-medium">{t('dbOrConnectionString')}</h3>
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
                  {testing ? t('testing') : t('dbTestConnection')}
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {saving ? t('saving') : tCommon('save')}
                </Button>
                {config?.hasExternalDb && (
                  <Button variant="destructive" onClick={handleDisconnect} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {tCommon('disconnect')}
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
                      <p className="text-success font-medium">{t('dbTestSuccessTitle')}</p>
                      {testResult.version && (
                        <p className="text-sm text-success mt-1">
                          {t('dbVersion', { version: testResult.version })}
                        </p>
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
          <h3 className="font-medium mb-3">{t('dbHowItWorks')}</h3>
          <ul className="space-y-2 text-sm text-foreground-muted">
            <li>
              • <strong>{t('dbHowSharedTitle')}</strong> {t('dbHowSharedBody')}
            </li>
            <li>
              • <strong>{t('dbHowExternalTitle')}</strong> {t('dbHowExternalBody')}
            </li>
            <li>• {t('dbHowTables')}</li>
            <li>• {t('dbHowDisconnect')}</li>
            <li>• {t('dbHowSupported')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
