/**
 * Eval-набір реальних питань AI-копілота (укр/рус) для П5.
 *
 * expectInSystem — маркери, які ОБОВʼЯЗКОВО мають бути в system-промпті
 * (знімок CRM / знайдені сутності / агрегати). Це й є «очікувана поведінка:
 * які дані мають потрапити в контекст».
 * expectNotInSystem — за замовчуванням REFUSAL_MARKERS (стара інструкція відмови).
 *
 * Фікстури описують тестові дані beforeAll у tools.test.ts:
 *   контакти: Zzztestperson Унікальний (ТОВ Zzztest, zzztestperson@example.com)
 *             + Чужий Контакт (чужой@example.com);
 *   воронка P → стадія S; угода «Угода Zzztest» 45000 UAH, open, probability 50;
 *   задача «Зателефонувати» [todo]; активність call «Дзвінок 12.09».
 */

export interface EvalQuestion {
  id: number;
  lang: 'uk' | 'ru';
  prompt: string;
  expectInSystem: string[];
  expectNotInSystem?: string[];
}

/** Маркери старого бага (П2): цих рядків у system бути не має. */
export const REFUSAL_MARKERS = ['Даних по цьому запиту в CRM немає', 'не маєш цих даних'];

export const AI_EVAL_QUESTIONS: EvalQuestion[] = [
  {
    id: 1,
    lang: 'uk',
    prompt: 'Як справи з продажами?',
    expectInSystem: ['Знімок CRM', 'Угоди: відкритих'],
  },
  {
    id: 2,
    lang: 'uk',
    prompt: 'Скільки в мене угод?',
    expectInSystem: ['Зведені дані CRM', 'відкритих — 1'],
  },
  {
    id: 3,
    lang: 'uk',
    prompt: 'Проаналізуй мою CRM',
    expectInSystem: ['Знімок CRM', 'Контакти: всього'],
  },
  {
    id: 4,
    lang: 'ru',
    prompt: 'Сколько контактов в базе?',
    expectInSystem: ['Контакти: всього — 2'],
  },
  {
    id: 5,
    lang: 'uk',
    prompt: 'Які угоди під ризиком?',
    expectInSystem: ['Зведені дані CRM', 'Угода Zzztest'],
  },
  {
    id: 6,
    lang: 'uk',
    prompt: 'Кому подзвонити сьогодні?',
    expectInSystem: ['Задачі: відкритих — 1', 'на сьогодні'],
  },
  {
    id: 7,
    lang: 'uk',
    prompt: 'Підсумок за тиждень',
    expectInSystem: ['Знімок CRM', 'виграних — 0'],
  },
  {
    id: 8,
    lang: 'uk',
    prompt: 'Покажи топ угод',
    expectInSystem: ['Угоди: відкритих', '45000 UAH'],
  },
  {
    id: 9,
    lang: 'uk',
    prompt: 'Яка конверсія у продажах?',
    expectInSystem: ['виграних — 0; програлих — 0'],
  },
  {
    id: 10,
    lang: 'uk',
    prompt: 'Які задачі прострочені?',
    expectInSystem: ['Задачі: активних — 1', 'прострочених — 0'],
  },
  {
    id: 11,
    lang: 'ru',
    prompt: 'Что нужно сделать сегодня?',
    expectInSystem: ['Задачі: відкритих — 1', 'на сьогодні — 0'],
  },
  {
    id: 12,
    lang: 'uk',
    prompt: 'Розкажи про Zzztestperson',
    expectInSystem: ['zzztestperson@example.com', 'Дані CRM'],
  },
  {
    id: 13,
    lang: 'uk',
    prompt: 'Який прогноз продажів?',
    expectInSystem: ['вагомий прогноз — 22500 UAH'],
  },
  {
    id: 14,
    lang: 'uk',
    prompt: 'Коли були останні активності?',
    expectInSystem: ['Останні активності', 'Дзвінок 12.09'],
  },
  {
    id: 15,
    lang: 'ru',
    prompt: 'Кто мой самый большой клиент?',
    expectInSystem: ['Топ відкритих угод', '45000 UAH'],
  },
  {
    id: 16,
    lang: 'uk',
    prompt: 'Покажи угоди з етапом S',
    expectInSystem: ['Зведені дані CRM', 'Угода Zzztest'],
  },
  {
    id: 17,
    lang: 'ru',
    prompt: 'Какие есть задачи?',
    expectInSystem: ['Задачі: активних — 1'],
  },
  {
    id: 18,
    lang: 'uk',
    prompt: 'Що відомо про компанію ТОВ Zzztest?',
    expectInSystem: ['ТОВ Zzztest', 'Дані CRM'],
  },
];
