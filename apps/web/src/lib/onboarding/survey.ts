/**
 * Опитування онбордингу: сфери, посади, досвід, задачі + пресети воронок.
 * Один файл для клієнта, API і тестів — щоб мапінг не розʼїхався.
 */

export interface SurveyOption {
  id: string;
  name: string;
}

export const INDUSTRIES: SurveyOption[] = [
  { id: 'beauty', name: 'Краса та догляд' },
  { id: 'medicine', name: 'Медицина' },
  { id: 'education', name: 'Освіта та курси' },
  { id: 'sport', name: 'Спорт' },
  { id: 'consulting', name: 'Консалтинг та агентства' },
  { id: 'hr', name: 'HR та рекрутинг' },
  { id: 'realestate', name: 'Нерухомість' },
  { id: 'hospitality', name: 'Готелі та гостинність' },
  { id: 'logistics', name: 'Транспорт і логістика' },
  { id: 'trade', name: 'Торгівля' },
  { id: 'manufacturing', name: 'Виробництво' },
  { id: 'it', name: 'IT та послуги' },
  { id: 'other', name: 'Інше' },
];

export const ROLES: SurveyOption[] = [
  { id: 'owner', name: 'Власник бізнесу' },
  { id: 'director', name: 'Директор / керівник напряму' },
  { id: 'sales_head', name: 'Керівник відділу продажів' },
  { id: 'manager', name: 'Менеджер з продажу' },
  { id: 'admin', name: 'Адміністратор' },
  { id: 'marketer', name: 'Маркетолог' },
  { id: 'other', name: 'Інше' },
];

export const EXPERIENCES: SurveyOption[] = [
  { id: 'none', name: 'Ні, вперше' },
  { id: 'other_crm', name: 'Так, іншою CRM' },
  { id: 'migrating', name: 'Переходжу з іншої CRM' },
];

export const PRIORITIES: SurveyOption[] = [
  { id: 'leads', name: 'Збір і обробка лідів' },
  { id: 'bookings', name: 'Записи клієнтів' },
  { id: 'comms', name: 'Комунікація (месенджери)' },
  { id: 'analytics', name: 'Аналітика бізнесу' },
  { id: 'team_control', name: 'Контроль співробітників' },
  { id: 'automation', name: 'Автоматизація процесів' },
  { id: 'other', name: 'Інше' },
];

export const DEFAULT_STAGES = ['Лід', 'Кваліфікація', 'Пропозиція', 'Переговори', 'Завершено'];

/** Пресет етапів воронки під сферу. Редагується на наступному кроці. */
export const STAGE_PRESETS: Record<string, string[]> = {
  beauty: ['Запис', 'Підтвердження', 'Візит', 'Оплата', 'Завершено'],
  medicine: ['Заявка', 'Запис', 'Візит', 'Лікування', 'Оплата'],
  education: ['Заявка', 'Пробне заняття', 'Договір', 'Оплата', 'Навчання'],
  sport: ['Заявка', 'Пробне тренування', 'Абонемент', 'Оплата', 'Продовження'],
  consulting: ['Лід', 'Зустріч', 'КП', 'Договір', 'Оплата'],
  hr: ['Заявка', 'Підбір', 'Співбесіда', 'Офер', 'Закриття'],
  realestate: ['Заявка', 'Перегляд', 'Бронь', 'Угода', 'Оплата'],
  hospitality: ['Заявка', 'Бронювання', 'Заселення', 'Проживання', 'Оплата'],
  logistics: ['Заявка', 'Розрахунок', 'Договір', 'Перевезення', 'Оплата'],
  trade: ['Лід', 'КП', 'Договір', 'Оплата', 'Повторний продаж'],
  manufacturing: ['Заявка', 'Прорахунок', 'Договір', 'Виробництво', 'Оплата'],
  it: [...DEFAULT_STAGES],
  other: [...DEFAULT_STAGES],
};

export function stagesForIndustry(industryId: string): string[] {
  return [...(STAGE_PRESETS[industryId] || DEFAULT_STAGES)];
}

export interface NextStep {
  label: string;
  href: string;
  hint: string;
}

/** Персональні наступні кроки під головну задачу (посилання на реальні розділи). */
export const PRIORITY_NEXT_STEPS: Record<string, NextStep[]> = {
  leads: [
    { label: 'Додати контакти', href: '/dashboard/contacts', hint: 'Вручну або імпортом' },
    { label: 'Створити угоду', href: '/dashboard/deals', hint: 'Перший лід у воронці' },
  ],
  bookings: [
    { label: 'Створити задачу', href: '/dashboard/tasks', hint: 'Запис як задача з дедлайном' },
    { label: 'Відкрити угоди', href: '/dashboard/deals', hint: 'Контроль записів по етапах' },
  ],
  comms: [
    {
      label: 'Підключити Telegram',
      href: '/dashboard/settings/telegram',
      hint: 'Листування в картці клієнта',
    },
    { label: 'Відкрити повідомлення', href: '/dashboard/messages', hint: 'Вхідні з месенджерів' },
  ],
  analytics: [
    {
      label: 'Відкрити аналітику',
      href: '/dashboard/analytics',
      hint: 'Воронка, конверсія, прогноз',
    },
    {
      label: 'Додати дані',
      href: '/dashboard/contacts',
      hint: 'Аналітика рахується з ваших даних',
    },
  ],
  team_control: [
    {
      label: 'Запросити команду',
      href: '/dashboard/settings/tenants',
      hint: 'Учасники бачать своє',
    },
    { label: 'Роздати задачі', href: '/dashboard/tasks', hint: 'З виконавцями і дедлайнами' },
  ],
  automation: [
    { label: 'Створити правило', href: '/dashboard/automation', hint: 'Тригери, дії, таймери' },
    { label: 'Підключити AI', href: '/dashboard/settings/ai-keys', hint: 'Оцінки угод і Co-Pilot' },
  ],
  other: [
    { label: 'Відкрити дашборд', href: '/dashboard', hint: 'Огляд і перші кроки' },
    { label: 'Пройти тур', href: '/dashboard', hint: 'Підказки по кожному розділу' },
  ],
};

export function nextStepsFor(priorityId: string): NextStep[] {
  return PRIORITY_NEXT_STEPS[priorityId] || PRIORITY_NEXT_STEPS.other;
}

export interface SurveyAnswers {
  industry: string;
  industryCustom: string | null;
  role: string;
  roleCustom: string | null;
  experience: string;
  experienceText: string | null;
  priorityTask: string;
  priorityCustom: string | null;
}

export const surveyIds = {
  industry: INDUSTRIES.map((o) => o.id),
  role: ROLES.map((o) => o.id),
  experience: EXPERIENCES.map((o) => o.id),
  priorityTask: PRIORITIES.map((o) => o.id),
};
