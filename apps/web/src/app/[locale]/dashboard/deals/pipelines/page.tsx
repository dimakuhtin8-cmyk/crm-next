'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { DataError } from '@/components/data-error';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface Stage {
  id?: string;
  name: string;
  color: string;
}
interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
  isDefault: boolean;
}

const stageColors = [
  '#2563eb',
  '#3b82f6',
  '#059669',
  '#d97706',
  '#0f172a',
  '#64748b',
  '#0891b2',
  '#0d9488',
  '#dc2626',
  '#65a30d',
];

export default function PipelinesPage() {
  const t = useTranslations('deals');
  const tCommon = useTranslations('common');
  const tRoot = useTranslations();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formStages, setFormStages] = useState<Array<{ name: string; color: string }>>([
    { name: tRoot('stages.lead'), color: stageColors[0] },
    { name: tRoot('stages.qualified'), color: stageColors[1] },
    { name: t('defaultStages.proposal'), color: stageColors[2] },
    { name: t('defaultStages.negotiation'), color: stageColors[3] },
    { name: t('defaultStages.closing'), color: stageColors[4] },
  ]);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/pipelines');
      if (!res.ok) throw new Error(t('errors.requestFailed', { status: res.status }));
      const data = await res.json();
      setPipelines(data.pipelines || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('errors.loadPipelines'));
    } finally {
      setLoading(false);
    }
  };

  const addStage = () =>
    setFormStages([
      ...formStages,
      { name: '', color: stageColors[formStages.length % stageColors.length] },
    ]);
  const removeStage = (i: number) => setFormStages(formStages.filter((_, idx) => idx !== i));
  const updateStage = (i: number, field: string, value: string) => {
    const stages = [...formStages];
    (stages[i] as Record<string, string>)[field] = value;
    setFormStages(stages);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, stages: formStages.filter((s) => s.name) }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setShowForm(false);
      setFormName('');
      fetchPipelines();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errors.createPipeline'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('confirmDeletePipeline', { name }))) return;
    try {
      const res = await fetch(`/api/pipelines/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error);
        return;
      }
      fetchPipelines();
    } catch {
      alert(t('errors.deletePipeline'));
    }
  };

  if (loading)
    return (
      <div className="max-w-4xl mx-auto">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('pipelinesTitle')}</h1>
          <p className="text-foreground-muted">{t('pipelinesDescription')}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/deals">
            <Button variant="outline">{t('backToDeals')}</Button>
          </Link>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? tCommon('cancel') : t('newPipeline')}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t('createPipeline')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('pipelineNameLabel')}
                </label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder={t('pipelineNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('stagesLabel')}
                </label>
                {formStages.map((stage, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={stage.color}
                      onChange={(e) => updateStage(i, 'color', e.target.value)}
                      className="h-9 w-9 rounded border border-border cursor-pointer"
                    />
                    <Input
                      value={stage.name}
                      onChange={(e) => updateStage(i, 'name', e.target.value)}
                      placeholder={t('stageNumber', { number: i + 1 })}
                      className="flex-1"
                    />
                    {formStages.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStage(i)}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addStage}>
                  {t('addStage')}
                </Button>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? t('creating') : t('createPipeline')}
              </Button>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      {loadError ? (
        <DataError message={loadError} onRetry={fetchPipelines} />
      ) : (
        <div className="space-y-4">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{pipeline.name}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(pipeline.id, pipeline.name)}
                    className="text-destructive"
                  >
                    {tCommon('delete')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {pipeline.stages.map((stage, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg"
                    >
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="text-sm">{stage.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
