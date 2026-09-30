'use client';

import Link from 'next/link';
import { useState } from 'react';

import { TOURS, tourDoneKey } from '@/components/tour/tour-config';
import { Button, Card, CardContent } from '@/components/ui';
import {
  EXPERIENCES,
  INDUSTRIES,
  PRIORITIES,
  ROLES,
  nextStepsFor,
  stagesForIndustry,
  type SurveyAnswers,
} from '@/lib/onboarding/survey';
import { useLocalePath, currentLocaleFromPath } from '@/lib/use-locale-path';
import { cn } from '@/lib/utils';

const TOTAL_STEPS = 8;

const BENEFITS = [
  'Автоматичне розподілення задач по етапах воронки',
  'Шаблони документів та КП за 1 клік',
  'AI-аналітика та рекомендації по угодам',
  'Нагадування про важливі дії та дедлайни',
];

function RadioCards({
  options,
  value,
  onPick,
}: {
  options: Array<{ id: string; name: string }>;
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onPick(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all',
            value === o.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:border-primary/50',
          )}
        >
          <span
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
              value === o.id ? 'border-primary' : 'border-border',
            )}
          >
            {value === o.id && <span className="h-2 w-2 rounded-full bg-primary" />}
          </span>
          {o.name}
        </button>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const lp = useLocalePath();
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [industryCustom, setIndustryCustom] = useState('');
  const [role, setRole] = useState('');
  const [roleCustom, setRoleCustom] = useState('');
  const [experience, setExperience] = useState('');
  const [experienceText, setExperienceText] = useState('');
  const [priorityTask, setPriorityTask] = useState('');
  const [priorityCustom, setPriorityCustom] = useState('');
  const [stages, setStages] = useState<string[]>(stagesForIndustry('other'));
  const [stagesTouched, setStagesTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pickIndustry = (id: string) => {
    setIndustry(id);
    if (!stagesTouched) setStages(stagesForIndustry(id));
  };

  const canNextSphere = industry !== '' && (industry !== 'other' || industryCustom.trim() !== '');
  const canNextRole = role !== '' && (role !== 'other' || roleCustom.trim() !== '');
  const canNextExp = experience !== '';
  const canNextTask =
    priorityTask !== '' && (priorityTask !== 'other' || priorityCustom.trim() !== '');

  const survey: SurveyAnswers | null =
    industry && role && experience && priorityTask
      ? {
          industry,
          industryCustom: industry === 'other' ? industryCustom.trim() : null,
          role,
          roleCustom: role === 'other' ? roleCustom.trim() : null,
          experience,
          experienceText: experienceText.trim() || null,
          priorityTask,
          priorityCustom: priorityTask === 'other' ? priorityCustom.trim() : null,
        }
      : null;

  const suppressTours = () => {
    // Досвідченим тури не навʼязуємо: позначаємо всі як пройдені.
    try {
      for (const key of Object.keys(TOURS)) {
        localStorage.setItem(tourDoneKey(key as keyof typeof TOURS), '1');
      }
    } catch {
      // localStorage недоступен — тури просто покажуться
    }
  };

  const handleSubmit = async (withSurvey: boolean) => {
    setLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          pipelineStages: stages,
          survey: withSurvey ? survey : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка збереження. Спробуйте ще раз.');
      // Новачкам лишаємо автостарт турів, досвідченим — вимикаємо.
      if (withSurvey && survey && survey.experience !== 'none') suppressTours();
      if (withSurvey) {
        setStep(7);
      } else {
        window.location.href = `/${currentLocaleFromPath()}/dashboard`;
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Помилка збереження.');
    } finally {
      setLoading(false);
    }
  };

  const addStage = () => {
    setStagesTouched(true);
    setStages([...stages, '']);
  };
  const updateStage = (i: number, value: string) => {
    setStagesTouched(true);
    const next = [...stages];
    next[i] = value;
    setStages(next);
  };
  const removeStage = (i: number) => {
    setStagesTouched(true);
    setStages(stages.filter((_, idx) => idx !== i));
  };

  const nav = (back: number, next: number | null, canNext: boolean, nextLabel = 'Далі') => (
    <div className="flex gap-3 pt-4">
      <Button onClick={() => setStep(back)} variant="outline" className="flex-1">
        Назад
      </Button>
      {next !== null && (
        <Button onClick={() => setStep(next)} className="flex-1" disabled={!canNext}>
          {nextLabel}
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className="flex-1 h-1.5 rounded-full bg-secondary transition-colors">
                <div
                  className={`h-full rounded-full transition-all ${i <= step ? 'bg-primary w-full' : 'w-0'}`}
                />
              </div>
            ))}
          </div>

          {submitError && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {submitError}
            </div>
          )}

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">👋</div>
                <h1 className="text-2xl font-bold">Ласкаво просимо до CRM-Next</h1>
                <p className="text-foreground-muted mt-2">
                  4 короткі питання — і CRM підлаштується під вашу сферу. Це займе не більше 2
                  хвилин.
                </p>
              </div>
              <div className="space-y-3">
                <Button onClick={() => setStep(1)} className="w-full" size="lg">
                  Почати налаштування
                </Button>
                <Button onClick={() => setShowSkipConfirm(true)} variant="ghost" className="w-full">
                  Пропустити налаштування
                </Button>
              </div>

              {/* Skip confirmation modal */}
              {showSkipConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-inverse/50 backdrop-blur-sm">
                  <Card className="w-full max-w-md mx-4">
                    <CardContent className="p-6 space-y-4">
                      <div className="text-center">
                        <div className="text-3xl mb-2">💡</div>
                        <h3 className="text-lg font-bold">Пропустити налаштування?</h3>
                        <p className="text-foreground-muted text-sm mt-2">
                          Налаштування займає лише 2 хвилини і дає переваги:
                        </p>
                      </div>
                      <ul className="space-y-2">
                        {BENEFITS.map((benefit, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-0.5">✓</span>
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-foreground-muted text-xs text-center">
                        Ви зможете налаштувати це пізніше в Налаштуваннях
                      </p>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => setShowSkipConfirm(false)}
                          variant="outline"
                          className="flex-1"
                        >
                          Все ж таки налаштувати
                        </Button>
                        <Button
                          onClick={() => handleSubmit(false)}
                          variant="ghost"
                          className="flex-1"
                          disabled={loading}
                        >
                          {loading ? 'Збереження...' : 'Пропустити'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Sphere */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Яка ваша сфера діяльності?</h2>
              <RadioCards options={INDUSTRIES} value={industry} onPick={pickIndustry} />
              {industry === 'other' && (
                <input
                  type="text"
                  value={industryCustom}
                  onChange={(e) => setIndustryCustom(e.target.value)}
                  placeholder="Введіть вашу сферу"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
              {nav(0, 2, canNextSphere)}
            </div>
          )}

          {/* Step 2: Role */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Ваша посада?</h2>
              <RadioCards options={ROLES} value={role} onPick={setRole} />
              {role === 'other' && (
                <input
                  type="text"
                  value={roleCustom}
                  onChange={(e) => setRoleCustom(e.target.value)}
                  placeholder="Введіть вашу посаду"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
              {nav(1, 3, canNextRole)}
            </div>
          )}

          {/* Step 3: Experience */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Раніше користувалися CRM?</h2>
              <RadioCards options={EXPERIENCES} value={experience} onPick={setExperience} />
              {(experience === 'other_crm' || experience === 'migrating') && (
                <input
                  type="text"
                  value={experienceText}
                  onChange={(e) => setExperienceText(e.target.value)}
                  placeholder="Якою саме? (необовʼязково)"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
              {experience === 'migrating' && (
                <p className="text-xs text-foreground-muted">
                  Підказка: базу можна перенести через{' '}
                  <Link href={lp('/dashboard/contacts')} className="text-primary hover:underline">
                    імпорт контактів
                  </Link>
                  .
                </p>
              )}
              {nav(2, 4, canNextExp)}
            </div>
          )}

          {/* Step 4: Priority task */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Ваша першочергова задача?</h2>
              <RadioCards options={PRIORITIES} value={priorityTask} onPick={setPriorityTask} />
              {priorityTask === 'other' && (
                <input
                  type="text"
                  value={priorityCustom}
                  onChange={(e) => setPriorityCustom(e.target.value)}
                  placeholder="Введіть вашу задачу"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
              {nav(3, 5, canNextTask)}
            </div>
          )}

          {/* Step 5: Company */}
          {step === 5 && (
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
              {nav(4, 6, true)}
            </div>
          )}

          {/* Step 6: Pipeline */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Воронка продажів</h2>
              <p className="text-foreground-muted text-sm">
                Етапи підібрані під вашу сферу. Можна змінити — пізніше теж.
              </p>
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
                      <button
                        onClick={() => removeStage(i)}
                        className="text-foreground-muted hover:text-danger transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addStage}
                className="text-sm text-primary hover:text-primary-hover transition-colors"
              >
                + Додати етап
              </button>
              <div className="flex gap-3 pt-4">
                <Button onClick={() => setStep(5)} variant="outline" className="flex-1">
                  Назад
                </Button>
                <Button
                  onClick={() => handleSubmit(true)}
                  className="flex-1"
                  disabled={loading || stages.some((s) => !s.trim())}
                >
                  {loading ? 'Збереження...' : 'Завершити'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 7: Finish */}
          {step === 7 && survey && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="text-4xl mb-3">✅</div>
                <h2 className="text-xl font-bold">Готово! CRM налаштовано</h2>
                <p className="text-foreground-muted text-sm mt-1">
                  {survey.experience === 'none'
                    ? 'Оскільки це ваша перша CRM — при вході вас зустріне короткий тур по інтерфейсу.'
                    : 'Підказки вимкнено: ви досвідчений користувач, але тур можна пройти з картки «Перші кроки».'}
                </p>
              </div>
              <div className="space-y-2">
                {nextStepsFor(survey.priorityTask).map((s) => (
                  <Link
                    key={s.href + s.label}
                    href={s.href}
                    className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
                  >
                    <span className="font-medium">{s.label}</span>
                    <span className="text-xs text-foreground-muted">{s.hint}</span>
                  </Link>
                ))}
              </div>
              <Button
                onClick={() => (window.location.href = `/${currentLocaleFromPath()}/dashboard`)}
                className="w-full"
                size="lg"
              >
                До дашборду
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
