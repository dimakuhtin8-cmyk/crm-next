'use client';

import {
  Check,
  ArrowRight,
  Loader2,
  ExternalLink,
  Users,
  Contact,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { DataError } from '@/components/data-error';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Progress,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { useLocale } from '@/lib/use-locale-path';

interface PlanInfo {
  id: string;
  name: string;
  description: string;
  price: number;
  yearlyPrice: number;
  currency: string;
}

interface SubscriptionInfo {
  status: string;
  endsAt: string | null;
  isTrial: boolean;
  trialDaysLeft: number;
  trialEndsAt: string | null;
}

interface PlanLimits {
  maxUsers: number;
  maxContacts: number;
  maxDeals: number;
  maxAiRequestsPerDay: number;
  maxPipelines: number;
  maxStorageGB: number;
  features: string[];
}

interface UsageInfo {
  users: number;
  contacts: number;
  deals: number;
}

interface SubscriptionData {
  plan: PlanInfo;
  subscription: SubscriptionInfo;
  limits: PlanLimits;
  usage: UsageInfo;
  hasPaymentMethod: boolean;
}

interface PlanCard {
  id: string;
  name: string;
  description: string;
  price: number;
  yearlyPrice: number;
  features: string[];
  isPopular?: boolean;
  maxUsers: number;
  maxContacts: number;
  maxDeals: number;
}

interface AiUsageData {
  today: { requests: number; limit: number; percentage: number };
}

export default function BillingPage() {
  const locale = useLocale();
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsageData | null>(null);
  // Вибір плану перед підтвердженням оновлення
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const loadSubscription = () => {
    setLoadError(null);
    setLoading(true);
    fetch('/api/billing/subscription', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(tCommon('errors.requestStatus', { status: r.status }));
        return r.json();
      })
      .then(setData)
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : t('billingSubscriptionLoadError'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Check for success/canceled params
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setMessage(t('billingPaymentSuccess'));
    } else if (params.get('canceled') === 'true') {
      setMessage(t('billingPaymentCanceled'));
    }
    loadSubscription();

    // Споживання AI-запитів для індикатора використання
    fetch('/api/ai/usage', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AiUsageData | null) => {
        if (d?.today) setAiUsage(d);
      })
      .catch(() => {
        console.warn('[billing] ai usage load failed');
      });
  }, []);

  const handleUpgrade = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, period, locale }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        toast.error(t('billingCheckoutError'), {
          description: json.error || t('tryAgain'),
        });
      }
    } catch {
      toast.error(t('billingCheckoutError'), { description: tCommon('connectionError') });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        toast.error(t('billingPortalError'), {
          description: json.error || t('tryAgain'),
        });
      }
    } catch {
      toast.error(t('billingPortalError'), {
        description: tCommon('connectionError'),
      });
    }
  };

  const formatPrice = (cents: number): string => {
    if (cents === 0) return t('billingFreePrice');
    return `$${(cents / 100).toFixed(0)}`;
  };

  const formatLimit = (n: number): string => {
    return n === -1 ? '∞' : n.toLocaleString('uk');
  };

  const usagePct = (used: number, limit: number): number | null =>
    limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;

  const pctColor = (pct: number): string =>
    pct >= 100 ? 'bg-danger' : pct >= 90 ? 'bg-warning' : 'bg-success';

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">{t('billingStatusActive')}</Badge>;
      case 'trialing':
        return <Badge variant="info">{t('billingStatusTrialing')}</Badge>;
      case 'past_due':
        return <Badge variant="warning">{t('billingStatusPastDue')}</Badge>;
      case 'canceled':
        return <Badge variant="danger">{t('billingStatusCanceled')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const ALL_PLANS: PlanCard[] = [
    {
      id: 'free',
      name: t('billingPlans.free.name'),
      description: t('billingPlans.free.description'),
      price: 0,
      yearlyPrice: 0,
      maxUsers: 1,
      maxContacts: 100,
      maxDeals: 20,
      features: [
        t('billingPlans.free.feature1'),
        t('billingPlans.free.feature2'),
        t('billingPlans.free.feature3'),
        t('billingPlans.free.feature4'),
      ],
    },
    {
      id: 'starter',
      name: t('billingPlans.starter.name'),
      description: t('billingPlans.starter.description'),
      price: 19,
      yearlyPrice: 190,
      maxUsers: 3,
      maxContacts: 1000,
      maxDeals: 200,
      features: [
        t('billingPlans.starter.feature1'),
        t('billingPlans.starter.feature2'),
        t('billingPlans.starter.feature3'),
        t('billingPlans.starter.feature4'),
        t('billingPlans.starter.feature5'),
      ],
    },
    {
      id: 'professional',
      name: t('billingPlans.professional.name'),
      description: t('billingPlans.professional.description'),
      price: 49,
      yearlyPrice: 490,
      maxUsers: 10,
      maxContacts: 10000,
      maxDeals: 2000,
      isPopular: true,
      features: [
        t('billingPlans.professional.feature1'),
        t('billingPlans.professional.feature2'),
        t('billingPlans.professional.feature3'),
        t('billingPlans.professional.feature4'),
        t('billingPlans.professional.feature5'),
        t('billingPlans.professional.feature6'),
        t('billingPlans.professional.feature7'),
      ],
    },
    {
      id: 'enterprise',
      name: t('billingPlans.enterprise.name'),
      description: t('billingPlans.enterprise.description'),
      price: 99,
      yearlyPrice: 990,
      maxUsers: -1,
      maxContacts: -1,
      maxDeals: -1,
      features: [
        t('billingPlans.enterprise.feature1'),
        t('billingPlans.enterprise.feature2'),
        t('billingPlans.enterprise.feature3'),
        t('billingPlans.enterprise.feature4'),
        t('billingPlans.enterprise.feature5'),
        t('billingPlans.enterprise.feature6'),
        t('billingPlans.enterprise.feature7'),
      ],
    },
  ];

  const selectedPlan = selectedPlanId
    ? (ALL_PLANS.find((p) => p.id === selectedPlanId) ?? null)
    : null;
  const selectedDisplayPrice = selectedPlan
    ? period === 'yearly'
      ? selectedPlan.yearlyPrice
      : selectedPlan.price
    : 0;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
            ← {tCommon('back')}
          </Link>
          <h1 className="text-2xl font-bold">{t('billingCardTitle')}</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
          ← {tCommon('back')}
        </Link>
        <h1 className="text-2xl font-bold">{t('billingCardTitle')}</h1>
      </div>

      {/* Сайт у розробці: CRM-послуги безкоштовно (рішення власника) */}
      <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
        <p className="text-sm font-medium">{tCommon('devNoticeTitle')}</p>
        <p className="text-sm text-foreground-muted">{tCommon('devNoticeBody')}</p>
      </div>

      {loadError && !data && <DataError message={loadError} onRetry={loadSubscription} />}

      {message && (
        <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-sm text-success">
          {message}
        </div>
      )}

      {/* Current Subscription */}
      {data && (
        <Card
          id="current-plan"
          className="bg-card border-border shadow-sm rounded-xl border-primary/20"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t('billingCurrentSubscription')}
              {statusBadge(data.subscription.status)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{data.plan.name}</p>
                <p className="text-sm text-foreground-muted">
                  {data.plan.price === 0
                    ? t('billingFreePrice')
                    : `$${data.plan.price / 100}/${t('billingPerMonth')}`}
                </p>
              </div>
              {data.subscription.isTrial && data.subscription.trialDaysLeft > 0 && (
                <div className="text-right">
                  <p className="text-sm font-medium text-warning">{t('billingStatusTrialing')}</p>
                  <p className="text-2xl font-bold">
                    {t('billingTrialDaysLeft', { count: data.subscription.trialDaysLeft })}
                  </p>
                </div>
              )}
              {data.subscription.endsAt && !data.subscription.isTrial && (
                <div className="text-right">
                  <p className="text-sm text-foreground-muted">{t('billingValidUntil')}</p>
                  <p className="text-sm font-medium">
                    {new Date(data.subscription.endsAt).toLocaleDateString('uk')}
                  </p>
                </div>
              )}
            </div>

            {/* Usage */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-accent/30">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
                  <Users className="w-3 h-3" /> {t('billingUsageUsers')}
                </div>
                <p className="text-lg font-semibold">
                  {data.usage.users}{' '}
                  <span className="text-sm text-foreground-muted">
                    / {formatLimit(data.limits.maxUsers)}
                  </span>
                </p>
                {usagePct(data.usage.users, data.limits.maxUsers) !== null && (
                  <Progress
                    value={usagePct(data.usage.users, data.limits.maxUsers)!}
                    indicatorClassName={pctColor(usagePct(data.usage.users, data.limits.maxUsers)!)}
                    className="mt-1.5"
                  />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
                  <Contact className="w-3 h-3" /> {t('billingUsageContacts')}
                </div>
                <p className="text-lg font-semibold">
                  {data.usage.contacts}{' '}
                  <span className="text-sm text-foreground-muted">
                    / {formatLimit(data.limits.maxContacts)}
                  </span>
                </p>
                {usagePct(data.usage.contacts, data.limits.maxContacts) !== null && (
                  <Progress
                    value={usagePct(data.usage.contacts, data.limits.maxContacts)!}
                    indicatorClassName={pctColor(
                      usagePct(data.usage.contacts, data.limits.maxContacts)!,
                    )}
                    className="mt-1.5"
                  />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
                  <Briefcase className="w-3 h-3" /> {t('billingUsageDeals')}
                </div>
                <p className="text-lg font-semibold">
                  {data.usage.deals}{' '}
                  <span className="text-sm text-foreground-muted">
                    / {formatLimit(data.limits.maxDeals)}
                  </span>
                </p>
                {usagePct(data.usage.deals, data.limits.maxDeals) !== null && (
                  <Progress
                    value={usagePct(data.usage.deals, data.limits.maxDeals)!}
                    indicatorClassName={pctColor(usagePct(data.usage.deals, data.limits.maxDeals)!)}
                    className="mt-1.5"
                  />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
                  <Sparkles className="w-3 h-3" /> {t('billingUsageAiRequests')}
                </div>
                <p className="text-lg font-semibold">
                  {aiUsage ? aiUsage.today.requests : '—'}{' '}
                  <span className="text-sm text-foreground-muted">
                    / {aiUsage ? aiUsage.today.limit : '—'}
                  </span>
                </p>
                {aiUsage && aiUsage.today.limit > 0 && (
                  <Progress
                    value={aiUsage.today.percentage}
                    indicatorClassName={pctColor(aiUsage.today.percentage)}
                    className="mt-1.5"
                  />
                )}
              </div>
            </div>

            {/* Вибір плану перед підтвердженням */}
            {selectedPlan && selectedPlan.id !== data.plan.id && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                <p className="text-sm">
                  {t('billingSelectedLabel')}{' '}
                  <span className="font-semibold">{selectedPlan.name}</span> —{' '}
                  {formatPrice(selectedDisplayPrice * 100)}
                  {selectedPlan.price > 0 && (
                    <span className="text-foreground-muted">
                      /{period === 'yearly' ? t('billingPerYear') : t('billingPerMonth')}
                    </span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSelectedPlanId(null)}>
                    {t('billingCancelSelection')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleUpgrade(selectedPlan.id)}
                    disabled={checkoutLoading === selectedPlan.id}
                  >
                    {checkoutLoading === selectedPlan.id && (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    )}
                    {t('billingConfirmUpgrade')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  document
                    .getElementById('plans')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {t('billingUpgradePlan')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              {data.plan.id !== 'free' && (
                <Button variant="outline" onClick={handleManageSubscription}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t('billingManageSubscription')}
                </Button>
              )}
              <Link href="/dashboard/settings/billing/history">
                <Button variant="ghost">{t('billingPaymentHistory')}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Toggle */}
      <div className="flex justify-center">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as 'monthly' | 'yearly')}>
          <TabsList>
            <TabsTrigger value="monthly">{t('billingMonthly')}</TabsTrigger>
            <TabsTrigger value="yearly">
              {t('billingYearly')} <span className="ml-1 text-success text-xs">-17%</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Plan Cards */}
      <div id="plans" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 scroll-mt-6">
        {ALL_PLANS.map((plan) => {
          const isCurrent = data?.plan.id === plan.id;
          const isSelected = !isCurrent && selectedPlanId === plan.id;
          const displayPrice = period === 'yearly' ? plan.yearlyPrice : plan.price;
          const selectable = !isCurrent && plan.price > 0;

          return (
            <Card
              key={plan.id}
              className={`relative bg-card shadow-sm rounded-xl ${plan.isPopular ? 'border-primary shadow-lg shadow-primary/10' : ''} ${isCurrent ? 'ring-2 ring-primary' : ''} ${isSelected ? 'ring-2 ring-primary/70 border-primary' : ''} ${selectable ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (selectable) setSelectedPlanId(plan.id);
              }}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded-full">
                    {t('billingPopular')}
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{formatPrice(displayPrice * 100)}</span>
                  {plan.price > 0 && (
                    <span className="text-sm text-foreground-muted">
                      /{period === 'yearly' ? t('billingPerYear') : t('billingPerMonth')}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-success shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button disabled className="w-full" variant="outline">
                    {t('billingCurrentPlan')}
                  </Button>
                ) : plan.price === 0 ? (
                  <Button disabled className="w-full" variant="outline">
                    {t('billingFreePlan')}
                  </Button>
                ) : isSelected ? (
                  <Button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={checkoutLoading === plan.id}
                    className={`w-full ${plan.isPopular ? 'bg-gradient-to-r from-primary to-primary-hover text-primary-foreground' : ''}`}
                  >
                    {checkoutLoading === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {tCommon('update')}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className="w-full"
                  >
                    {t('billingSelectPlan')}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
