'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
} from '@/components/ui';

const TIMEZONES = [
  { value: 'Europe/Kyiv', label: 'Київ (EET/EEST)' },
  { value: 'Europe/Warsaw', label: 'Варшава (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Берлін (CET/CEST)' },
  { value: 'UTC', label: 'UTC' },
];

const LANGUAGES = [
  { value: 'uk', label: 'Українська' },
  { value: 'en', label: 'English' },
];

export default function ProfileSettingsPage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name || '');
  const [email] = useState(session?.user?.email || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Додаткові поля профілю (візуальна повнота — бекенд зберігає лише name)
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('Europe/Kyiv');
  const [language, setLanguage] = useState('uk');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await update({ name });
      setSuccess('Профіль оновлено');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
          ← Назад
        </Link>
        <h1 className="text-2xl font-bold">Профіль</h1>
      </div>

      {success && (
        <div className="p-3 bg-success/10 text-success rounded-lg text-sm">{success}</div>
      )}
      {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>Персональні дані</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar
                src={session?.user?.image ?? undefined}
                name={name || email || 'Користувач'}
                size="lg"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">{name || 'Без імені'}</p>
                <p className="text-xs text-foreground-muted">{email}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-name" className="text-xs text-foreground-muted">
                  Ім&apos;я
                </Label>
                <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email" className="text-xs text-foreground-muted">
                  Email
                </Label>
                <Input id="profile-email" value={email} disabled />
                <p className="text-xs text-foreground-muted">
                  Email змінюється через налаштування акаунту
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone" className="text-xs text-foreground-muted">
                  Телефон
                </Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  placeholder="+380 __ ___ __ __"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-timezone" className="text-xs text-foreground-muted">
                  Часовий пояс
                </Label>
                <Select
                  id="profile-timezone"
                  value={timezone}
                  onValueChange={setTimezone}
                  className="w-full"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-language" className="text-xs text-foreground-muted">
                  Мова інтерфейсу
                </Label>
                <Select
                  id="profile-language"
                  value={language}
                  onValueChange={setLanguage}
                  className="w-full"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Збереження...' : 'Зберегти'}
              </Button>
              <span className="text-xs text-foreground-muted">
                Зберігається ім&apos;я профілю (телефон, пояс і мова — демонстраційні поля)
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
