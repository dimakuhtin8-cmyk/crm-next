import { getProvider, type AiProvider } from './providers';

import { decrypt } from '@/lib/encryption';

export interface GenerateResult {
  response: string;
  model: string;
}

/** Provider HTTP error with status + body (for error mapping and tool-fallback). */
export class AiApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'AiApiError';
  }
}

/** A provider-neutral tool definition (OpenAI/Anthropic/Gemini wire formats). */
export interface AiToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GenerateWithToolsOptions extends GenerateOptions {
  tools: AiToolSpec[];
  /** Executes ONE tool call and returns its text content for the model. */
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
}

export interface GenerateWithToolsResult {
  response: string;
  model: string;
  /** Tool rounds actually executed (0..MAX_TOOL_ITERATIONS). */
  iterations: number;
}

/** П3.2: max tool rounds per answer; the final turn runs WITHOUT tools. */
export const MAX_TOOL_ITERATIONS = 4;

const TOOL_LIMIT_NOTE =
  'Ліміт викликів інструментів вичерпано — відповідай за вже отриманими даними та знімком CRM.';

/**
 * A 400 that mentions tool/function/schema = provider rejected the tools
 * payload → caller silently falls back to the snapshot mode (П1), no user error.
 */
export function isToolFormatError(error: unknown): boolean {
  return (
    error instanceof AiApiError &&
    error.httpStatus === 400 &&
    /tool|function|schema/i.test(error.body)
  );
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  tenantApiKey?: string | null;
  tenantAiProvider?: string | null;
  tenantAiModel?: string | null;
  /** Multi-turn dialogue before the current prompt. Single-turn callers omit it. */
  history?: ChatHistoryItem[];
}

/** Bound context size: last 20 turns max. */
const MAX_HISTORY = 20;

function tailHistory(history?: ChatHistoryItem[]): ChatHistoryItem[] {
  if (!history || history.length === 0) return [];
  return history.slice(-MAX_HISTORY);
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
          'пересохраните его в настройках (Настройки → AI-провайдери)',
      );
    }
  } else if (process.env.GEMINI_API_KEY) {
    apiKey = process.env.GEMINI_API_KEY;
  } else {
    return null;
  }

  const model = tenantAiModel || provider.models[0]?.id || 'gemini-3-flash-preview';
  return { provider, apiKey, model };
}

async function callAi(
  prompt: string,
  system?: string,
  config?: AiConfig | null,
  history?: ChatHistoryItem[],
): Promise<string> {
  if (!config) throw new Error('AI не налаштовано. Оберіть провайдера та додайте API-ключ.');

  if (config.provider.id === 'gemini') {
    return callGemini(prompt, system, config.apiKey, config.model, history);
  }

  return callOpenAiCompatible(prompt, system, config, history);
}

async function callGemini(
  prompt: string,
  system: string | undefined,
  apiKey: string,
  model: string,
  history?: ChatHistoryItem[],
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (system) {
    contents.push({ role: 'user', parts: [{ text: system }] });
    contents.push({ role: 'model', parts: [{ text: 'Зрозуміло.' }] });
  }
  for (const h of tailHistory(history)) {
    contents.push({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error('Gemini error:', err);
    throw new AiApiError(`Gemini API помилка: ${res.status}`, res.status, err);
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

async function callOpenAiCompatible(
  prompt: string,
  system: string | undefined,
  config: AiConfig,
  history?: ChatHistoryItem[],
): Promise<string> {
  if (config.provider.id === 'anthropic') {
    return callAnthropic(prompt, system, config, history);
  }

  const endpoint = PROVIDER_ENDPOINTS[config.provider.id] || PROVIDER_ENDPOINTS.custom;

  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  for (const h of tailHistory(history)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error('AI API error:', err);
    throw new AiApiError(`AI API помилка: ${res.status}`, res.status, err);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('AI не повернув текст');
  return text;
}

async function callAnthropic(
  prompt: string,
  system: string | undefined,
  config: AiConfig,
  history?: ChatHistoryItem[],
): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  for (const h of tailHistory(history)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: prompt });
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
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error('Anthropic error:', err);
    throw new AiApiError(`Anthropic API помилка: ${res.status}`, res.status, err);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Anthropic не повернув текст');
  return text;
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const config = resolveConfig(
    options.tenantApiKey,
    options.tenantAiProvider,
    options.tenantAiModel,
  );
  const response = await callAi(options.prompt, options.system, config, options.history);
  return { response, model: config?.model || 'unknown' };
}

// ---------------------------------------------------------------------------
// П3: function-calling loop (read-only tools).
// Wire formats (verified against docs, see tools.ts registry comments):
//   gemini    — v1beta generateContent: tools[].functionDeclarations,
//               parts[].functionCall / parts[].functionResponse.
//   openai    — chat completions: tools[].function (JSON Schema),
//               message.tool_calls → role:'tool' messages.
//   anthropic — messages: tools[].input_schema, content[].tool_use →
//               role:'user' content[].tool_result.
// Bounded: ≤ MAX_TOOL_ITERATIONS tool rounds, then ONE final turn without
// tools to force a text answer. Unknown/unsupported providers never reach
// this function — the caller falls back to plain generate() (П1 mode).
// ---------------------------------------------------------------------------

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  label: string,
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(`${label} error:`, errText.slice(0, 500));
    throw new AiApiError(`${label} API помилка: ${res.status}`, res.status, errText);
  }
  return res.json();
}

function buildGeminiContents(options: GenerateWithToolsOptions): Array<Record<string, unknown>> {
  const contents: Array<Record<string, unknown>> = [];
  if (options.system) {
    contents.push({ role: 'user', parts: [{ text: options.system }] });
    contents.push({ role: 'model', parts: [{ text: 'Зрозуміло.' }] });
  }
  for (const h of tailHistory(options.history)) {
    contents.push({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: options.prompt }] });
  return contents;
}

async function geminiToolLoop(
  options: GenerateWithToolsOptions,
  config: AiConfig,
): Promise<GenerateWithToolsResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const contents = buildGeminiContents(options);
  let iterations = 0;

  for (let turn = 0; turn <= MAX_TOOL_ITERATIONS; turn++) {
    const withTools = turn < MAX_TOOL_ITERATIONS && iterations < MAX_TOOL_ITERATIONS;
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens || 4096,
      },
    };
    if (withTools) {
      body.tools = [
        {
          functionDeclarations: options.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
      body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
    }

    const data = await postJson(url, {}, body, 'Gemini');
    const parts = (data?.candidates?.[0]?.content?.parts || []) as Array<{
      text?: string;
      functionCall?: { name: string; args?: Record<string, unknown> };
    }>;
    const calls = parts.filter((p) => p.functionCall);
    const text = parts
      .map((p) => (typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('\n');

    if (calls.length > 0 && withTools) {
      contents.push({
        role: 'model',
        parts: calls.map((p) => ({ functionCall: p.functionCall })),
      });
      const budget = MAX_TOOL_ITERATIONS - iterations;
      let executed = 0;
      for (const p of calls) {
        const fn = String(p.functionCall?.name || 'unknown');
        let result: string;
        if (executed >= budget) {
          result = TOOL_LIMIT_NOTE;
        } else {
          result = await options.executeTool(
            fn,
            (p.functionCall?.args || {}) as Record<string, unknown>,
          );
          iterations++;
          executed++;
        }
        contents.push({
          role: 'user',
          parts: [{ functionResponse: { name: fn, response: { name: fn, content: result } } }],
        });
      }
      continue;
    }

    if (!text) {
      // Defensive: model returned a tool call on the final (tools-less) turn.
      if (calls.length > 0) return { response: TOOL_LIMIT_NOTE, model: config.model, iterations };
      throw new Error('Gemini не повернув текст');
    }
    return { response: text, model: config.model, iterations };
  }
  throw new Error('Ліміт ітерацій tool-циклу вичерпано');
}

async function openAiToolLoop(
  options: GenerateWithToolsOptions,
  config: AiConfig,
): Promise<GenerateWithToolsResult> {
  const endpoint = PROVIDER_ENDPOINTS[config.provider.id] || PROVIDER_ENDPOINTS.custom;
  const messages: Array<Record<string, unknown>> = [];
  if (options.system) messages.push({ role: 'system', content: options.system });
  for (const h of tailHistory(options.history)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: options.prompt });
  let iterations = 0;

  for (let turn = 0; turn <= MAX_TOOL_ITERATIONS; turn++) {
    const withTools = turn < MAX_TOOL_ITERATIONS && iterations < MAX_TOOL_ITERATIONS;
    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || 4096,
    };
    if (withTools) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      body.tool_choice = 'auto';
    }

    const data = await postJson(endpoint, { Authorization: `Bearer ${config.apiKey}` }, body, 'AI');
    const message = data?.choices?.[0]?.message;
    const toolCalls: Array<{
      id: string;
      function?: { name?: string; arguments?: string };
    }> = Array.isArray(message?.tool_calls) ? message.tool_calls : [];

    if (toolCalls.length > 0 && withTools) {
      messages.push({
        role: 'assistant',
        content: message?.content ?? null,
        tool_calls: toolCalls,
      });
      const budget = MAX_TOOL_ITERATIONS - iterations;
      let executed = 0;
      for (const tc of toolCalls) {
        const fn = String(tc.function?.name || 'unknown');
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(String(tc.function?.arguments || '{}'));
        } catch {
          args = {};
        }
        let result: string;
        if (executed >= budget) {
          result = TOOL_LIMIT_NOTE;
        } else {
          result = await options.executeTool(fn, args);
          iterations++;
          executed++;
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
      continue;
    }

    if (toolCalls.length > 0) {
      // Defensive: tool call arrived on the final (tools-less) turn.
      return { response: TOOL_LIMIT_NOTE, model: config.model, iterations };
    }
    const text = message?.content;
    if (typeof text !== 'string' || !text) throw new Error('AI не повернув текст');
    return { response: text, model: config.model, iterations };
  }
  throw new Error('Ліміт ітерацій tool-циклу вичерпано');
}

async function anthropicToolLoop(
  options: GenerateWithToolsOptions,
  config: AiConfig,
): Promise<GenerateWithToolsResult> {
  const messages: Array<Record<string, unknown>> = [];
  for (const h of tailHistory(options.history)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: options.prompt });
  let iterations = 0;

  for (let turn = 0; turn <= MAX_TOOL_ITERATIONS; turn++) {
    const withTools = turn < MAX_TOOL_ITERATIONS && iterations < MAX_TOOL_ITERATIONS;
    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: options.maxTokens || 4096,
      system: options.system || 'You are a helpful assistant.',
      messages,
    };
    if (withTools) {
      body.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const data = await postJson(
      'https://api.anthropic.com/v1/messages',
      {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
      'Anthropic',
    );
    const content: Array<{
      type?: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }> = Array.isArray(data?.content) ? data.content : [];
    const toolUses = content.filter((b) => b.type === 'tool_use');

    if (toolUses.length > 0 && withTools) {
      messages.push({ role: 'assistant', content });
      const budget = MAX_TOOL_ITERATIONS - iterations;
      let executed = 0;
      const results: Array<Record<string, unknown>> = [];
      for (const tu of toolUses) {
        let result: string;
        if (executed >= budget) {
          result = TOOL_LIMIT_NOTE;
        } else {
          result = await options.executeTool(
            String(tu.name),
            (tu.input || {}) as Record<string, unknown>,
          );
          iterations++;
          executed++;
        }
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: result });
      }
      messages.push({ role: 'user', content: results });
      continue;
    }

    if (toolUses.length > 0) {
      // Defensive: tool call arrived on the final (tools-less) turn.
      return { response: TOOL_LIMIT_NOTE, model: config.model, iterations };
    }
    const text = content
      .filter((b) => b.type === 'text')
      .map((b) => b.text || '')
      .join('\n');
    if (!text) throw new Error('Anthropic не повернув текст');
    return { response: text, model: config.model, iterations };
  }
  throw new Error('Ліміт ітерацій tool-циклу вичерпано');
}

/**
 * Tool-enabled generation. Callers must pre-check supportsTools(provider, model);
 * on a provider-side tools-format 400 (isToolFormatError) they fall back to
 * plain generate() — the user never sees an error because of tools.
 */
export async function generateWithTools(
  options: GenerateWithToolsOptions,
): Promise<GenerateWithToolsResult> {
  const config = resolveConfig(
    options.tenantApiKey,
    options.tenantAiProvider,
    options.tenantAiModel,
  );
  if (!config) throw new Error('AI не налаштовано. Оберіть провайдера та додайте API-ключ.');

  if (config.provider.id === 'gemini') return geminiToolLoop(options, config);
  if (config.provider.id === 'anthropic') return anthropicToolLoop(options, config);
  return openAiToolLoop(options, config);
}

export async function generateKP(
  deal: {
    title: string;
    value: number | null;
    currency: string;
    company?: string | null;
    notes?: string | null;
    stage?: string | null;
  },
  tenantApiKey?: string | null,
  tenantAiProvider?: string | null,
  tenantAiModel?: string | null,
): Promise<string> {
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

export async function generateFollowUp(
  deal: {
    title: string;
    company?: string | null;
    stage?: string | null;
    daysSinceLastActivity?: number;
  },
  tenantApiKey?: string | null,
  tenantAiProvider?: string | null,
  tenantAiModel?: string | null,
): Promise<string> {
  const config = resolveConfig(tenantApiKey, tenantAiProvider, tenantAiModel);
  const system = `Ти — менеджер з продажів. Напиши коротке ввічливе повідомлення (3-5 речень) українською з call-to-action.`;

  const prompt = `Follow-up для угоди:
Назва: ${deal.title}
Клієнт: ${deal.company || 'Не вказано'}
Етап: ${deal.stage || 'Невідомий'}
Днів без активності: ${deal.daysSinceLastActivity || 'Невідомо'}`;

  return callAi(prompt, system, config);
}

export async function analyzeContact(
  contact: {
    firstName: string;
    lastName?: string | null;
    company?: string | null;
    email?: string | null;
    activities: Array<{ type: string; title: string; date: string }>;
    deals?: Array<{ title: string; stage: string; value: number | null }>;
  },
  tenantApiKey?: string | null,
  tenantAiProvider?: string | null,
  tenantAiModel?: string | null,
): Promise<string> {
  const config = resolveConfig(tenantApiKey, tenantAiProvider, tenantAiModel);
  const system = `Ти — CRM аналітик. Проаналізуй контакт українською.
Відповідь у форматі:
## Статус
Короткий опис поточного стану

## Рекомендації
- Конкретні дії

## Ризики
- Що може піти не так`;

  const activitiesList = contact.activities
    .map((a) => `- ${a.type}: ${a.title} (${a.date})`)
    .join('\n');
  const dealsList =
    contact.deals
      ?.map((d) => `- ${d.title} [${d.stage}] ${d.value ? d.value + '₴' : ''}`)
      .join('\n') || 'Немає';

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

export async function scoreDeal(
  deal: {
    title: string;
    value: number | null;
    stage: string;
    daysInStage: number;
    totalActivities: number;
    daysSinceLastActivity: number;
    hasContact: boolean;
  },
  tenantApiKey?: string | null,
  tenantAiProvider?: string | null,
  tenantAiModel?: string | null,
): Promise<number> {
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

export async function generateRecommendations(
  data: {
    overdueTasks: Array<{ title: string; dueDate: string; contact?: string }>;
    staleDeals: Array<{ title: string; daysSince: number; stage: string }>;
    expiringContracts: Array<{ company: string; expiresAt: string }>;
  },
  tenantApiKey?: string | null,
  tenantAiProvider?: string | null,
  tenantAiModel?: string | null,
): Promise<string> {
  const config = resolveConfig(tenantApiKey, tenantAiProvider, tenantAiModel);
  const system = `Ти — CRM асистент. Створи план роботи на сьогодні українською.
Формат: короткий, структурований список пріоритетних дій.
Максимум 7 пунктів. Почни з найважливішого.`;

  const tasksList = data.overdueTasks
    .map(
      (t) => `- "${t.title}" (дедлайн: ${t.dueDate}${t.contact ? `, клієнт: ${t.contact}` : ''})`,
    )
    .join('\n');
  const dealsList = data.staleDeals
    .map((d) => `- "${d.title}" [${d.stage}] — ${d.daysSince} днів без активності`)
    .join('\n');
  const contractsList = data.expiringContracts
    .map((c) => `- ${c.company} — ${c.expiresAt}`)
    .join('\n');

  const prompt = `Створи план на сьогодні:

Прострочені задачі:
${tasksList || 'Немає'}

Загальні угоди:
${dealsList || 'Немає'}

Контракти що спливають:
${contractsList || 'Немає'}`;

  return callAi(prompt, system, config);
}

export async function smartSearch(
  query: string,
  tenantApiKey?: string | null,
  tenantAiProvider?: string | null,
  tenantAiModel?: string | null,
): Promise<{
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
  } catch {
    // не JSON — вернём fallback ниже
  }
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
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`,
        { signal: AbortSignal.timeout(5000) },
      );
      return res.ok;
    }

    // For OpenAI-compatible: just try to list models or do a minimal request
    const endpoint = PROVIDER_ENDPOINTS[config.provider.id];
    if (!endpoint) return false;

    if (config.provider.id === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      return res.ok || res.status === 400; // 400 = key works but bad request
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok || res.status === 400;
  } catch {
    return false;
  }
}

// Legacy export
export const checkGemini = checkAi;
