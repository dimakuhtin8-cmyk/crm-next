'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

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
  { value: 'Europe/Kyiv', label: 'timezoneKyiv' },
  { value: 'Europe/Warsaw', label: 'timezoneWarsaw' },
  { value: 'Europe/Berlin', label: 'timezoneBerlin' },
  { value: 'UTC', label: 'timezoneUtc' },
];

const LANGUAGES = [
  { value: 'uk', label: 'languageUk' },
  { value: 'en', label: 'languageEn' },
];

const PHONE_RE = /^\+?[0-9][0-9 ()-]{6,17}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type FieldErrors = {
  name?: string;
  email?: string;
  phone?: string;
  timezone?: string;
};

export default function ProfileSettingsPage() {
  const { data: session, update } = useSession();
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [name, setName] = useState(session?.user?.name || '');
  const [email] = useState(session?.user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Додаткові поля профілю (персиститься лише name — колонок у БД немає)
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('Europe/Kyiv');
  const [language, setLanguage] = useState('uk');

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const trimmed = name.trim();
    if (trimmed.length < 2) next.name = t('errors.nameMin');
    else if (trimmed.length > 100) next.name = t('errors.nameMax');
    if (!email) next.email = t('errors.emailMissing');
    else if (!EMAIL_RE.test(email)) next.email = t('errors.emailInvalid');
    if (phone.trim() && !PHONE_RE.test(phone.trim())) {
      next.phone = t('errors.phoneInvalid');
    }
    if (!timezone) next.timezone = t('errors.timezoneRequired');
    return next;
  };

  const setField = <K extends keyof FieldErrors>(key: K, value: string | undefined) => {
    setErrors((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(t('checkForm'), { description: t('checkFormDescription') });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await update({ name: name.trim() });
      toast.success(t('profileSaved'));
    } catch (err) {
      toast.error(t('profileSaveError'), {
        description: err instanceof Error ? err.message : t('tryAgain'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="text-foreground-muted hover:text-foreground">
          ← {tCommon('back')}
        </Link>
        <h1 className="text-2xl font-bold">{t('profile')}</h1>
      </div>

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle>{t('personalData')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} noValidate className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar
                src={session?.user?.image ?? undefined}
                name={name || email || t('defaultUserName')}
                size="lg"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">{name || t('noName')}</p>
                <p className="text-xs text-foreground-muted">{email}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-name" className="text-xs text-foreground-muted">
                  {t('nameLabel')}
                </Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setField('name', undefined);
                  }}
                  error={errors.name}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email" className="text-xs text-foreground-muted">
                  Email
                </Label>
                <Input id="profile-email" value={email} disabled error={errors.email} />
                <p className="text-xs text-foreground-muted">{t('emailChangeHint')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone" className="text-xs text-foreground-muted">
                  {t('phoneLabel')}
                </Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  placeholder="+380 __ ___ __ __"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errors.phone) setField('phone', undefined);
                  }}
                  error={errors.phone}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-timezone" className="text-xs text-foreground-muted">
                  {t('timezoneLabel')}
                </Label>
                <Select
                  id="profile-timezone"
                  value={timezone}
                  onValueChange={(v) => {
                    setTimezone(v);
                    if (errors.timezone) setField('timezone', undefined);
                  }}
                  className="w-full"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {t(tz.label)}
                    </option>
                  ))}
                </Select>
                {errors.timezone && <p className="text-xs text-danger">{errors.timezone}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-language" className="text-xs text-foreground-muted">
                  {t('interfaceLanguageLabel')}
                </Label>
                <Select
                  id="profile-language"
                  value={language}
                  onValueChange={setLanguage}
                  className="w-full"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {t(lang.label)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isSubmitting ? t('saving') : tCommon('save')}
              </Button>
              <span className="text-xs text-foreground-muted">{t('profileSaveNote')}</span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
