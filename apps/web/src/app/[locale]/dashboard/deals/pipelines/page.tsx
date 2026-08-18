'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Stage { id?: string; name: string; color: string }
interface Pipeline { id: string; name: string; stages: Stage[]; isDefault: boolean }

const stageColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

export default function PipelinesPage() {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formStages, setFormStages] = useState<Array<{ name: string; color: string }>>([
    { name: 'Лід', color: stageColors[0] },
    { name: 'Кваліфікація', color: stageColors[1] },
    { name: 'Пропозиція', color: stageColors[2] },
    { name: 'Перемовини', color: stageColors[3] },
    { name: 'Закриття', color: stageColors[4] },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchPipelines(); }, []);

  const fetchPipelines = async () => {
    try {
      const res = await fetch('/api/pipelines');
      const data = await res.json();
      setPipelines(data.pipelines || []);
    } catch {} finally { setLoading(false); }
  };

  const addStage = () => setFormStages([...formStages, { name: '', color: stageColors[formStages.length % stageColors.length] }]);
  const removeStage = (i: number) => setFormStages(formStages.filter((_, idx) => idx !== i));
  const updateStage = (i: number, field: string, value: string) => {
    const stages = [...formStages];
    (stages[i] as Record<string, string>)[field] = value;
    setFormStages(stages);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, stages: formStages.filter((s) => s.name) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setShowForm(false); setFormName(''); fetchPipelines();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Видалити воронку "${name}"?`)) return;
    try {
      const res = await fetch(`/api/pipelines/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); alert(d.error); return; }
      fetchPipelines();
    } catch {}
  };

  if (loading) return <div className="max-w-4xl mx-auto"><div className="h-8 bg-muted rounded w-1/3 animate-pulse" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Воронки</h1>
          <p className="text-foreground-muted">Налаштування воронок продажів</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/deals"><Button variant="outline">До угод</Button></Link>
          <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Скасувати' : '+ Нова воронка'}</Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Створити воронку</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Назва воронки *</label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="Продажі, Оренда, тощо" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Етапи</label>
                {formStages.map((stage, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input type="color" value={stage.color} onChange={(e) => updateStage(i, 'color', e.target.value)} className="h-9 w-9 rounded border border-border cursor-pointer" />
                    <Input value={stage.name} onChange={(e) => updateStage(i, 'name', e.target.value)} placeholder={`Етап ${i + 1}`} className="flex-1" />
                    {formStages.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeStage(i)}>×</Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addStage}>+ Додати етап</Button>
              </div>
              <Button type="submit" disabled={saving}>{saving ? 'Створення...' : 'Створити воронку'}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {pipelines.map((pipeline) => (
          <Card key={pipeline.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{pipeline.name}</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleDelete(pipeline.id, pipeline.name)} className="text-destructive">Видалити</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {pipeline.stages.map((stage, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm">{stage.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
