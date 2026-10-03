// Правові документи та юридичні прив'язки інтерфейсу за законодавством України:
// футер, згода при реєстрації/вході, cookie-банер, реквізити, три документи /legal/*.
// Тип тесту: статичний скан fs-файлів (патерн tour-anchors.test.ts).

import * as fs from 'fs';
import * as path from 'path';

import { describe, expect, it } from 'vitest';

import { defaultLocale, locales } from '@/i18n/config';
import { siteOwnerLine, SITE_OWNER } from '@/lib/legal/company';

const SRC = path.resolve(__dirname, '..', '..', '..');

function read(rel: string): string {
  const abs = path.join(SRC, rel);
  expect(fs.existsSync(abs), `файл ${rel} має існувати`).toBe(true);
  return fs.readFileSync(abs, 'utf8');
}

describe('локалізація: українська за замовчуванням', () => {
  it("defaultLocale === 'uk'", () => {
    expect(defaultLocale).toBe('uk');
    expect(locales).toContain('uk');
  });
});

describe('реквізити субʼєкта господарювання', () => {
  it('SITE_OWNER містить форму, ПІБ та email', () => {
    expect(siteOwnerLine).toBe('Фізична особа Кухтін Дмитро Олександрович');
    expect(SITE_OWNER.email).toBe('helpnebulacrm@gmail.com');
  });

  it('футер лендінгу посилається на документи та реквізити', () => {
    const content = read('app/[locale]/page.tsx');
    expect(content).toContain('/legal/oferta');
    expect(content).toContain('/legal/privacy');
    expect(content).toContain('/legal/dpa');
    expect(content).toContain('siteOwnerLine');
    expect(content).toContain('SITE_OWNER.email');
    expect(content).toContain('адміністратор персональних даних');
  });

  it('layout /legal має реквізити та навігацію між документами', () => {
    const content = read('app/[locale]/legal/layout.tsx');
    expect(content).toContain('siteOwnerLine');
    expect(content).toContain('mailto:${SITE_OWNER.email}');
    expect(content).toContain('LegalNav');
    expect(content).toContain('/legal/oferta');
    expect(content).toContain('/legal/privacy');
    expect(content).toContain('/legal/dpa');
  });
});

describe('юридичні привʼязки сторінок входу та реєстрації', () => {
  it('реєстрація: згода під кнопкою з двома клікабельними лінками', () => {
    const content = read('app/[locale]/auth/register/page.tsx');
    expect(content).toContain('Реєструючись, ви погоджуєтесь із');
    expect(content).toContain("lp('/legal/oferta')");
    expect(content).toContain("lp('/legal/privacy')");
    // згода має бути безпосередньо під кнопкою «Зареєструватися»
    const buttonAt = content.indexOf('Зареєструватися');
    const consentAt = content.indexOf('Реєструючись, ви погоджуєтесь із');
    expect(buttonAt).toBeGreaterThan(0);
    expect(consentAt).toBeGreaterThan(buttonAt);
  });

  it('вхід: лінк на Політику конфіденційності (вимога Google OAuth)', () => {
    const content = read('app/[locale]/auth/login/page.tsx');
    expect(content).toContain("lp('/legal/privacy')");
    expect(content).toContain("lp('/legal/oferta')");
    expect(content).toContain('Політикою конфіденційності');
  });
});

describe('cookie-банер першого візиту', () => {
  it('банер змонтовано у провайдерах локалі', () => {
    const content = read('app/[locale]/providers.tsx');
    expect(content).toContain("from '@/components/legal/cookie-banner'");
    expect(content).toContain('<CookieBanner');
  });

  it('банер показується до згоди та веде на Політику#cookie', () => {
    const content = read('components/legal/cookie-banner.tsx');
    expect(content).toContain("COOKIE_CONSENT_KEY = 'crm_next_cookie_consent'");
    expect(content).toContain('localStorage.getItem(COOKIE_CONSENT_KEY)');
    expect(content).toContain('privacy#cookie');
    expect(content).toContain('role="region"');
    expect(content).toContain('Зрозуміло');
  });
});

describe('три правові документи', () => {
  it('публічна оферта: оплата, автопродовження, блокування, «як є»', () => {
    const content = read('app/[locale]/legal/oferta/page.tsx');
    expect(content).toContain('Публічна оферта');
    expect(content).toContain('автоматично');
    expect(content).toContain('рекуррентн');
    expect(content).toContain('блокування облікового запису');
    expect(content).toContain('як є');
    expect(content).toContain('633');
    expect(content).toContain('/legal/privacy');
    expect(content).toContain('/legal/dpa');
  });

  it('політика конфіденційності: cookie, AI без тренування, № 2297-VI', () => {
    const content = read('app/[locale]/legal/privacy/page.tsx');
    expect(content).toContain('id="cookie"');
    expect(content).toContain('не використовуються для навчання');
    expect(content).toContain('2297-VI');
    expect(content).toContain('SITE_OWNER.email');
    expect(content).toContain('право на забуття');
  });

  it('DPA: контролер/оброблювач, власні цілі, 72 години', () => {
    const content = read('app/[locale]/legal/dpa/page.tsx');
    expect(content).toContain('Контролер');
    expect(content).toContain('Оброблювач');
    expect(content).toContain('у власних цілях');
    expect(content).toContain('72');
    expect(content).toContain('субоброблювач');
    expect(content).toContain('GDPR');
  });
});
