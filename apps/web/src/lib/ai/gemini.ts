import { getProvider, type AiProvider } from './providers';
import { decrypt } from '@/lib/encryption';

export interface GenerateResult {
  response: string;
  model: string;
}

export interface GenerateOptions {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  tenantApiKey?: string | null;
  tenantAiProvider?: string | null;
  tenantAiModel?: string | null;
}

interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

function resolveConfig(
  tenantApiKey?: string | null,
  tenantAiProvider?: string | null,
  tenantAiModel?: string | null,
): AiConfig | null {
  const providerId = tenantAiProvider || 'gemini';
  const provider = getProvider(providerId);
  if (!provider) return null;

  // Two key states, handled differently:
  // - DB key (tenantApiKey) MUST be encrypted — legacy plaintext is an error.
  // - Env fallback (GEMINI_API_KEY) is ALWAYS plaintext — used as-is.
  let apiKey: string;
  if (tenantApiKey) {
    try {
      apiKey = decrypt(tenantApiKey);
    } catch {
      throw new Error(
        'Ваш API-ключ повреждён или сохранён в устаревшем формате — ' +
        'пересохраните его в настройках (Настройки → AI-провайдери)'
      );
    }
  } else if (process.env.GEMINI_API_KEY) {
    apiKey = process.env.GEMINI_API_KEY;
  } else {
    return null;
  }

  const model = tenantAiModel || provider.models[0]?.id || 'gemini-2.0-flash';
  return { provider, apiKey, model };
}

async function callAi(prompt: string, system?: string, config?: AiConfig | null): Promise<string> {
  if (!config) throw new Error('AI не налаштовано. Оберіть провайдера та додайте API-ключ.');

  if (config.provider.id === 'gemini') {
    return callGemini(prompt, system, config.apiKey, config.model);
  }

  return callOpenAiCompatible(prompt, system, config);
}

async function callGemini(prompt: string, system: string | undefined, apiKey: string, model: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (system) {
    contents.push({ role: 'user', parts: [{ text: system }] });
    contents.push({ role: 'model', parts: [{ text: 'Зрозуміло.' }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 4096 } }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Gemini error:', err);
    throw new Error(`Gemini API помилка: ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini не повернув текст');
  return text;
}

// OpenAI-compatible providers: OpenAI, Anthropic (via proxy), DeepSeek, Groq, Mistral, Together, custom
const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
  together: 'https://api.together.xyz/v1/chat/completions',
  custom: 'https://api.openai.com/v1/chat/completions',
};

async function callOpenAiCompatible(prompt: string, system: string | undefined, config: AiConfig): Promise<string> {
  if (config.provider.id === 'anthropic') {
    return callAnthropic(prompt, system, config);
  }

  const endpoint = PROVIDER_ENDPOINTS[config.provider.id] || PROVIDER_ENDPOINTS.custom;

  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('AI API error:', err);
    throw new Error(`AI API помилка: ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('AI не повернув текст');
  return text;
}

async function callAnthropic(prompt: string, system: string | undefined, config: AiConfig): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: system || 'You are a helpful assistant.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Anthropic error:', err);
    throw new Error(`Anthropic API помилка: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Anthropic не повернув текст');
  return text;
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const config = resolveConfig(options.tenantApiKey, options.tenantAiProvider, options.tenantAiModel);
  const response = await callAi(options.prompt, options.system, config);
  return { response, model: config?.model || 'unknown' };
}

export async function generateKP(deal: {
  title: string;
  value: number | null;
  currency: string;
  company?: string | null;
  notes?: string | null;
  stage?: string | null;
}, tenantApiKey?: string | null, tenantAiProvider?: string | null, tenantAiModel?: string | null): Promise<string> {
  const config = resolveConfig(tenantApiKey, tenantAiProvider, tenantAiModel);
  const system = `Ти — досвідчений менеджер з продажів. Створи професійний комерційний пропозицію (КП) українською мовою.
Формат: 1.Заголовок 2.Опис проблеми 3.Рішення 4.Переваги 5.Ціна 6.Терміни 7.Контакти. Професійний тон.`;

  const prompt = `Створи КП:
Назва: ${deal.title}
Клієнт: ${deal.company || 'Не вказано'}
Сума: ${deal.value ? `${deal.value.toLocaleString('uk')} ${deal.currency}` : 'Не вказано'}
Нотатки: ${deal.notes || 'Немає'}
Етап: ${deal.stage || 'Невідомий'}`;

  return callAi(prompt, system, config);
}

export async function generateFollowUp(deal: {
  title: string;
  company?: string | null;
  stage?: string | null;
  daysSinceLastActivity?: number;
}, tenantApiKey?: string | null, tenantAiProvider?: string | null, tenantAiModel?: string | null): Promise<string> {
  const config = resolveConfig(tenantApiKey, tenantAiProvider, tenantAiModel);
  const system = `Ти — менеджер з продажів. Напиши коротке ввічливе повідомлення (3-5 речень) українською з call-to-action.`;

  const prompt = `Follow-up для угоди:
Назва: ${deal.title}
Клієнт: ${deal.company || 'Не вказано'}
Етап: ${deal.stage || 'Невідомий'}
Днів без активності: ${deal.daysSinceLastActivity || 'Невідомо'}`;

  return callAi(prompt, system, config);
}

export async function analyzeContact(contact: {
  firstName: string;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
  activities: Array<{ type: string; title: string; date: string }>;
  deals?: Array<{ title: string; stage: string; value: number | null }>;
}, tenantApiKey?: string | null, tenantAiProvider?: string | null, tenantAiModel?: string | null): Promise<string> {
  const config = resolveConfig(tenantApiKey, tenantAiProvider, tenantAiModel);
  const system = `Ти — CRM аналітик. Проаналізуй контакт українською.
Відповідь у форматі:
## Статус
Короткий опис поточного стану

## Рекомендації
- Конкретні дії

## Ризики
- Що може піти не так`;

  const activitiesList = contact.activities.map((a) => `- ${a.type}: ${a.title} (${a.date})`).join('\n');
  const dealsList = contact.deals?.map((d) => `- ${d.title} [${d.stage}] ${d.value ? d.value + '₴' : ''}`).join('\n') || 'Немає';

  const prompt = `Проаналізуй контакт:
Ім'я: ${contact.firstName} ${contact.lastName || ''}
Компанія: ${contact.company || 'Не вказано'}
Email: ${contact.email || 'Не вказано'}
Активності (останні 10):
${activitiesList || 'Немає'}
Угоди:
${dealsList}`;

  return callAi(prompt, system, config);
}

export async function scoreDeal(deal: {
  title: string;
  value: number | null;
  stage: string;
  daysInStage: number;
  totalActivities: number;
  daysSinceLastActivity: number;
  hasContact: boolean;
}, tenantApiKey?: string | null, tenantAiProvider?: string | null, tenantAiModel?: string | null): Promise<number> {
  const config = resolveConfig(tenantApiKey, tenantAiProvider, tenantAiModel);
  const system = `Ти — CRM аналітик. Оцінім ймовірність закриття угоди від 0 до 100.
Поверни ТІЛЬКИ число (ціле), без тексту.

Критерії:
- Етап воронки (чим далі — тим вище)
- Кількість активностей (більше — краще)
- Дні без активності (довше — гірше)
- Наявність контакту (є — краще)
- Час на поточному етапі (занадто довго — погано)`;

  const prompt = `Оціни угоду:
Назва: ${deal.title}
Сума: ${deal.value || 'Не вказано'}
Етап: ${deal.stage}
Днів на етапі: ${deal.daysInStage}
Активностей: ${deal.totalActivities}
Днів без активності: ${deal.daysSinceLastActivity}
Є контакт: ${deal.hasContact ? 'Так' : 'Ні'}`;

  const result = await callAi(prompt, system, config);
  const num = parseInt(result.replace(/\D/g, ''), 10);
  return Math.min(100, Math.max(0, isNaN(num) ? 50 : num));
}

export async function generateRecommendations(data: {
  overdueTasks: Array<{ title: string; dueDate: string; contact?: string }>;
  staleDeals: Array<{ title: string; daysSince: number; stage: string }>;
  expiringContracts: Array<{ company: string; expiresAt: string }>;
}, tenantApiKey?: string | null, tenantAiProvider?: string | null, tenantAiModel?: string | null): Promise<string> {
  const config = resolveConfig(tenantApiKey, tenantAiProvider, tenantAiModel);
  const system = `Ти — CRM асистент. Створи план роботи на сьогодні українською.
Формат: короткий, структурований список пріоритетних дій.
Максимум 7 пунктів. Почни з найважливішого.`;

  const tasksList = data.overdueTasks.map((t) => `- "${t.title}" (дедлайн: ${t.dueDate}${t.contact ? `, клієнт: ${t.contact}` : ''})`).join('\n');
  const dealsList = data.staleDeals.map((d) => `- "${d.title}" [${d.stage}] — ${d.daysSince} днів без активності`).join('\n');
  const contractsList = data.expiringContracts.map((c) => `- ${c.company} — ${c.expiresAt}`).join('\n');

  const prompt = `Створи план на сьогодні:

Прострочені задачі:
${tasksList || 'Немає'}

Загальні угоди:
${dealsList || 'Немає'}

Контракти що спливають:
${contractsList || 'Немає'}`;

  return callAi(prompt, system, config);
}

export async function smartSearch(query: string, tenantApiKey?: string | null, tenantAiProvider?: string | null, tenantAiModel?: string | null): Promise<{
  intent: string;
  filters: Record<string, string>;
  suggestion: string;
}> {
  const config = resolveConfig(tenantApiKey, tenantAiProvider, tenantAiModel);
  const system = `Ти — пошуковий асистент CRM. Проаналізуй запит користувача українською.
Поверни JSON у форматі:
{
  "intent": "contacts|deals|tasks",
  "filters": { "field": "value" },
  "suggestion": "що знайдено"
}

Поля для фільтрів:
Контакти: firstName, lastName, company, email, status, source
Задачі: title, status, priority, assigneeId
Угоди: title, stage, status, currency

Приклади:
"покажи всіх з IT" → {"intent":"contacts","filters":{"company":"IT"},"suggestion":"Контакти з IT"}
"задачі з високим пріоритетом" → {"intent":"tasks","filters":{"priority":"high"},"suggestion":"Задачі з високим пріоритетом"}`;

  const result = await callAi(query, system, config);
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  return { intent: 'contacts', filters: {}, suggestion: result.slice(0, 200) };
}

export async function checkAi(
  tenantApiKey?: string | null,
  tenantAiProvider?: string | null,
  tenantAiModel?: string | null,
): Promise<boolean> {
  const config = resolveConfig(tenantApiKey, tenantAiProvider, tenantAiModel);
  if (!config) return false;

  try {
    if (config.provider.id === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`, { signal: AbortSignal.timeout(5000) });
      return res.ok;
    }

    // For OpenAI-compatible: just try to list models or do a minimal request
    const endpoint = PROVIDER_ENDPOINTS[config.provider.id];
    if (!endpoint) return false;

    if (config.provider.id === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: config.model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
        signal: AbortSignal.timeout(10000),
      });
      return res.ok || res.status === 400; // 400 = key works but bad request
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok || res.status === 400;
  } catch {
    return false;
  }
}

// Legacy export
export const checkGemini = checkAi;
