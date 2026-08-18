'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

const locales = [
  { code: 'uk', label: 'УКР', flag: '🇺🇦' },
  { code: 'en', label: 'ENG', flag: '🇬🇧' },
  { code: 'ru', label: 'РУС', flag: '🇷🇺' },
];

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleLocaleChange(newLocale: string) {
    // Replace locale in pathname
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPathname);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border p-1">
      {locales.map((l) => (
        <button
          key={l.code}
          onClick={() => handleLocaleChange(l.code)}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            locale === l.code
              ? 'bg-indigo-500/10 text-indigo-500'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          title={l.label}
        >
          <span>{l.flag}</span>
          <span className="hidden sm:inline">{l.label}</span>
        </button>
      ))}
    </div>
  );
}
