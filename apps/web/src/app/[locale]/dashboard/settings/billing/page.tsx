'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CreditCard, Check, ArrowRight, Loader2, Clock, AlertTriangle,
  ExternalLink, Zap, Users, Contact, Briefcase, HardDrive,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from '@/components/ui';

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

const ALL_PLANS: PlanCard[] = [
  {
    id: 'free',
    name: 'Безкоштовний',
    description: 'Для ознайомлення',
    price: 0,
    yearlyPrice: 0,
    maxUsers: 1,
    maxContacts: 100,
    maxDeals: 20,
    features: ['1 користувач', '100 контактів', '20 угод', '50 AI-запитів/день'],
  },
  {
    id: 'starter',
    name: 'Стартовий',
    description: 'Для малого бізнесу',
    price: 19,
    yearlyPrice: 190,
    maxUsers: 3,
    maxContacts: 1000,
    maxDeals: 200,
    features: ['3 користувача', '1,000 контактів', '200 угод', '500 AI-запитів/день', '3 воронки'],
  },
  {
    id: 'professional',
    name: 'Професійний',
    description: 'Для команд продажів',
    price: 49,
    yearlyPrice: 490,
    maxUsers: 10,
    maxContacts: 10000,
    maxDeals: 2000,
    isPopular: true,
    features: ['10 користувачів', '10,000 контактів', '2,000 угод', '1,500 AI-запитів/день', '10 воронок', 'Автоматизації', 'Звіти'],
  },
  {
    id: 'enterprise',
    name: 'Підприємство',
    description: 'Для великих компаній',
    price: 99,
    yearlyPrice: 990,
    maxUsers: -1,
    maxContacts: -1,
    maxDeals: -1,
    features: ['Необмежено користувачів', 'Необмежено контактів', 'Необмежено угод', '5,000 AI-запитів/день', 'Необмежено воронок', 'API доступ', 'Пріоритетна підтримка'],
  },
];

export default function BillingPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check for success/canceled params
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setMessage('Оплата успішна! Вашу підписку оновлено.');
    } else if (params.get('canceled') === 'true') {
      setMessage('Оплату скасовано.');
    }

    fetch('/api/billing/subscription', { credentials: 'include' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, period }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      }
    } catch {} finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      }
    } catch {}
  };

  const formatPrice = (cents: number): string => {
    if (cents === 0) return 'Безкоштовно';
    return `$${(cents / 100).toFixed(0)}`;
  };

  const formatLimit = (n: number): string => {
    return n === -1 ? '∞' : n.toLocaleString('uk');
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-700 dark:text-green-300">Активна</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-300">Пробний період</Badge>;
      case 'past_due':
        return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300">Прострочена</Badge>;
      case 'canceled':
        return <Badge className="bg-red-500/10 text-red-700 dark:text-red-300">Скасована</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">← Назад</Link>
          <h1 className="text-2xl font-bold">Підписка та оплата</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 bg-accent/30 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">← Назад</Link>
        <h1 className="text-2xl font-bold">Підписка та оплата</h1>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-700 dark:text-green-300">
          {message}
        </div>
      )}

      {/* Current Subscription */}
      {data && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Поточна підписка
              {statusBadge(data.subscription.status)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{data.plan.name}</p>
                <p className="text-sm text-foreground-muted">
                  {data.plan.price === 0 ? 'Безкоштовно' : `$${data.plan.price / 100}/міс`}
                </p>
              </div>
              {data.subscription.isTrial && data.subscription.trialDaysLeft > 0 && (
                <div className="text-right">
                  <p className="text-sm font-medium text-amber-600">Пробний період</p>
                  <p className="text-2xl font-bold">{data.subscription.trialDaysLeft} дн.</p>
                </div>
              )}
              {data.subscription.endsAt && !data.subscription.isTrial && (
                <div className="text-right">
                  <p className="text-sm text-foreground-muted">Діє до</p>
                  <p className="text-sm font-medium">
                    {new Date(data.subscription.endsAt).toLocaleDateString('uk')}
                  </p>
                </div>
              )}
            </div>

            {/* Usage */}
            <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-accent/30">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
                  <Users className="w-3 h-3" /> Користувачі
                </div>
                <p className="text-lg font-semibold">
                  {data.usage.users} <span className="text-sm text-foreground-muted">/ {formatLimit(data.limits.maxUsers)}</span>
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
                  <Contact className="w-3 h-3" /> Контакти
                </div>
                <p className="text-lg font-semibold">
                  {data.usage.contacts} <span className="text-sm text-foreground-muted">/ {formatLimit(data.limits.maxContacts)}</span>
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1">
                  <Briefcase className="w-3 h-3" /> Угоди
                </div>
                <p className="text-lg font-semibold">
                  {data.usage.deals} <span className="text-sm text-foreground-muted">/ {formatLimit(data.limits.maxDeals)}</span>
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {data.plan.id !== 'free' && (
                <Button variant="outline" onClick={handleManageSubscription}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Керувати підпискою
                </Button>
              )}
              <Link href="/dashboard/settings/billing/history">
                <Button variant="ghost">Історія платежів</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Toggle */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 p-1 rounded-xl bg-accent/50">
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === 'monthly'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            Щомісячно
          </button>
          <button
            onClick={() => setPeriod('yearly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === 'yearly'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            Щорічно <span className="text-green-600 text-xs">-17%</span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ALL_PLANS.map((plan) => {
          const isCurrent = data?.plan.id === plan.id;
          const displayPrice = period === 'yearly' ? plan.yearlyPrice : plan.price;
          const priceLabel = plan.price === 0
            ? 'Безкоштовно'
            : period === 'yearly'
              ? `$${plan.yearlyPrice}/рік`
              : `$${plan.price}/міс`;

          return (
            <Card
              key={plan.id}
              className={`relative ${plan.isPopular ? 'border-primary shadow-lg shadow-primary/10' : ''} ${isCurrent ? 'ring-2 ring-primary' : ''}`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded-full">
                    Популярний
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
                      /{period === 'yearly' ? 'рік' : 'міс'}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button disabled className="w-full" variant="outline">
                    Поточний план
                  </Button>
                ) : plan.price === 0 ? (
                  <Button disabled className="w-full" variant="outline">
                    Безкоштовний
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={checkoutLoading === plan.id}
                    className={`w-full ${plan.isPopular ? 'bg-gradient-to-r from-primary to-purple-600 text-white' : ''}`}
                  >
                    {checkoutLoading === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Оновити
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
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
