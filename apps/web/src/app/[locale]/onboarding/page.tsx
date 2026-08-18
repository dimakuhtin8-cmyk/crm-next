'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Card, CardContent } from '@/components/ui';

const INDUSTRIES = [
  'IT та технології', 'Маркетинг', 'Консалтинг', 'Нерухомість',
  'Фінанси', 'Охорона здоров\'я', 'Освіта', 'Виробництво',
  'Роздрібна торгівля', 'Транспорт', 'Інше',
];

const DEFAULT_STAGES = [
  'Лід', 'Кваліфікація', 'Пропозиція', 'Переговори', 'Завершено',
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [stages, setStages] = useState<string[]>(DEFAULT_STAGES);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, industry, pipelineStages: stages }),
      });
      if (res.ok) {
        router.push('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const addStage = () => setStages([...stages, '']);
  const updateStage = (i: number, value: string) => {
    const next = [...stages];
    next[i] = value;
    setStages(next);
  };
  const removeStage = (i: number) => setStages(stages.filter((_, idx) => idx !== i));

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 h-1.5 rounded-full bg-secondary transition-colors">
                <div className={`h-full rounded-full transition-all ${i <= step ? 'bg-primary w-full' : 'w-0'}`} />
              </div>
            ))}
          </div>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">👋</div>
                <h1 className="text-2xl font-bold">Ласкаво просимо до CRM-Next</h1>
                <p className="text-foreground-muted mt-2">Налаштуємо ваш CRM за кілька кроків</p>
              </div>
              <div className="space-y-3">
                <Button onClick={() => setStep(1)} className="w-full" size="lg">
                  Почати налаштування
                </Button>
                <Button onClick={handleSubmit} variant="ghost" className="w-full">
                  Пропустити налаштування
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Company */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Ваша компанія</h2>
              <div>
                <label className="block text-sm font-medium mb-1">Назва компанії</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Назва вашої компанії"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Сфера діяльності</label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((ind) => (
                    <button
                      key={ind}
                      onClick={() => setIndustry(ind)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        industry === ind
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-foreground/30'
                      }`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button onClick={() => setStep(0)} variant="outline" className="flex-1">Назад</Button>
                <Button onClick={() => setStep(2)} className="flex-1">Далі</Button>
              </div>
            </div>
          )}

          {/* Step 2: Pipeline */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Воронка продажів</h2>
              <p className="text-foreground-muted text-sm">Налаштуйте етапи вашої воронки. Пізніше зможете змінити.</p>
              <div className="space-y-2">
                {stages.map((stage, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-medium">
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      value={stage}
                      onChange={(e) => updateStage(i, e.target.value)}
                      className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {stages.length > 2 && (
                      <button onClick={() => removeStage(i)} className="text-foreground-muted hover:text-danger transition-colors">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addStage} className="text-sm text-primary hover:text-primary-hover transition-colors">
                + Додати етап
              </button>
              <div className="flex gap-3 pt-4">
                <Button onClick={() => setStep(1)} variant="outline" className="flex-1">Назад</Button>
                <Button onClick={handleSubmit} className="flex-1" disabled={loading}>
                  {loading ? 'Збереження...' : 'Завершити'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
