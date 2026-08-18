const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export interface GenerateOptions {
  model?: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResult {
  response: string;
  model: string;
  totalDuration?: number;
}

/**
 * Check if Ollama is available
 */
export async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * List available models
 */
export async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    const data = await res.json();
    return data.models?.map((m: { name: string }) => m.name) || [];
  } catch {
    return [];
  }
}

/**
 * Generate text using Ollama
 */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const model = options.model || 'llama3.2';

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: options.prompt,
      system: options.system,
      stream: false,
      options: {
        temperature: options.temperature || 0.7,
        num_predict: options.maxTokens || 2048,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status}`);
  }

  const data = await res.json();
  return {
    response: data.response,
    model: data.model || model,
    totalDuration: data.total_duration,
  };
}

/**
 * Generate a commercial proposal (КП) for a deal
 */
export async function generateKP(deal: {
  title: string;
  value: number | null;
  currency: string;
  company?: string | null;
  notes?: string | null;
  stage?: string | null;
}): Promise<string> {
  const system = `Ти — досвідчений менеджер з продажів. Створи професійний комерційний пропозицію (КП) українською мовою.
Формат:
1. Заголовок з назвою послуги
2. Опис проблеми клієнта
3. Наше рішення
4. Переваги
5. Ціна та умови
6. Терміни
7. Контакти

Використовуй професійний тон. Будь конкретним.`;

  const prompt = `Створи КП для угоди:
Назва: ${deal.title}
Клієнт: ${deal.company || 'Не вказано'}
Сума: ${deal.value ? `${deal.value.toLocaleString('uk')} ${deal.currency}` : 'Не вказано'}
Нотатки: ${deal.notes || 'Немає'}
Етап: ${deal.stage || 'Невідомий'}`;

  const result = await generate({ prompt, system, temperature: 0.8, maxTokens: 3000 });
  return result.response;
}

/**
 * Generate a follow-up message for a deal
 */
export async function generateFollowUp(deal: {
  title: string;
  company?: string | null;
  stage?: string | null;
  daysSinceLastActivity?: number;
}): Promise<string> {
  const system = `Ти — менеджер з продажів. Напиши коротке ввічливе повідомлення для клієнта українською.
Повідомлення має бути: персоналізованим, коротким (3-5 речень), з чітким call-to-action.`;

  const prompt = `Напиши follow-up для угоди:
Назва: ${deal.title}
Клієнт: ${deal.company || 'Не вказано'}
Етап: ${deal.stage || 'Невідомий'}
Днів з останньої активності: ${deal.daysSinceLastActivity || 'Невідомо'}`;

  const result = await generate({ prompt, system, temperature: 0.7, maxTokens: 500 });
  return result.response;
}

/**
 * Analyze a contact and suggest next actions
 */
export async function analyzeContact(contact: {
  firstName: string;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
  activities: Array<{ type: string; title: string; date: string }>;
}): Promise<string> {
  const system = `Ти — CRM аналітик. Проаналізуй контакт і запропонуй наступні дії.
Відповідь українською. Будь конкретним і практичним.`;

  const activitiesList = contact.activities.map((a) => `- ${a.type}: ${a.title} (${a.date})`).join('\n');

  const prompt = `Проаналізуй контакт:
Ім'я: ${contact.firstName} ${contact.lastName || ''}
Компанія: ${contact.company || 'Не вказано'}
Email: ${contact.email || 'Не вказано'}

Активності:
${activitiesList || 'Немає активностей'}

Запропонуй:
1. Що зробити далі
2. Який канал зв'язку обрати
3. Що написати/сказати`;

  const result = await generate({ prompt, system, temperature: 0.7, maxTokens: 1000 });
  return result.response;
}
