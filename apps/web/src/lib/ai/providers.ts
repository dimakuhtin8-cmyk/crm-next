export interface AiProvider {
  id: string;
  name: string;
  logo: string;
  description: string;
  keyUrl: string;
  keyPlaceholder: string;
  keyPrefix: string;
  models: AiModel[];
  freeQuota: string;
}

export interface AiModel {
  id: string;
  name: string;
  description: string;
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    logo: '/logos/gemini.webp',
    description: 'Від Google. Найкраще розуміє українську мову. 1M контекст.',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIza...',
    keyPrefix: 'AIza',
    freeQuota: '15 запитів/хв, 1500/день',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 3.1 Pro', description: 'Розширені можливості (розв\'язання складних задач)' },
      { id: 'gemini-2.5-flash', name: 'Gemini 3.6 Flash', description: 'Новинка — універсальна допомога' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 3.5 Flash-Lite', description: 'Найшвидші відповіді' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    logo: '/logos/openai.webp',
    description: 'GPT-5.6 Sol, Terra, Luna — флагманська лінійка 2026.',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-...',
    keyPrefix: 'sk-',
    freeQuota: 'Безкоштовний кредит $5 при реєстрації',
    models: [
      { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', description: 'Флагман для складних задач розмірковування та коду' },
      { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', description: 'Збалансований варіант (інтелект + помірна вартість)' },
      { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', description: 'Економічна модель для великих обсягів запитів' },
      { id: 'gpt-5.3-codex', name: 'GPT-5.3-Codex', description: 'Спеціалізована для агентного програмування' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    logo: '/logos/anthropic.webp',
    description: 'Claude 5 — найрозумніший AI для агентів та коду. 1M контекст.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-...',
    keyPrefix: 'sk-ant-',
    freeQuota: 'Безкоштовний кредит при реєстрації',
    models: [
      { id: 'claude-opus-5', name: 'Fable 5 (Pro)', description: 'Для найскладніших завдань' },
      { id: 'claude-opus-4', name: 'Opus 5 (Pro)', description: 'Для складних задач' },
      { id: 'claude-sonnet-4', name: 'Sonnet 5', description: 'Найефективніша для щоденних задач' },
      { id: 'claude-haiku-4-5', name: 'Haiku 4.5', description: 'Найшвидша для швидких відповідей' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: '/logos/deepseek.jpg',
    description: 'V4 Flash та Pro — найдешевший AI у світі ($0.14/MTok).',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyPlaceholder: 'sk-...',
    keyPrefix: 'sk-',
    freeQuota: '~10M токенів безкоштовно при реєстрації',
    models: [
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', description: 'Флагман з просунутими агентськими можливостями' },
      { id: 'deepseek-r1', name: 'DeepSeek-R1 / R1-0528', description: 'Моделі розмірковування (reasoning, chain-of-thought)' },
      { id: 'deepseek-v3', name: 'DeepSeek-V3 / V3.2', description: 'Моделі загального призначення (MoE 671B)' },
      { id: 'deepseek-vl2', name: 'DeepSeek-VL2', description: 'Мультимодальна (текст, візуалізація, таблиці)' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    logo: '/logos/groq.png',
    description: 'Найшвидший інференс (~500 tps). Llama 4, GPT-OSS.',
    keyUrl: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
    keyPrefix: 'gsk_',
    freeQuota: 'Щедрий безкоштовний тариф',
    models: [
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', description: 'Флагманська з розмірковуванням та інструментами' },
      { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', description: 'Легка версія для логічних задач' },
      { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B', description: 'Високошвидкісна модель розмірковування' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    logo: '/logos/mistral.webp',
    description: 'Французький AI. Large 3 (675B MoE), Small 4, Codestral.',
    keyUrl: 'https://console.mistral.ai/api-keys/',
    keyPlaceholder: 'mist-...',
    keyPrefix: 'mist-',
    freeQuota: 'Безкоштовний тариф з обмеженнями',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large 3', description: 'Флагманська мультимодальна модель (MoE)' },
      { id: 'mistral-small-latest', name: 'Mistral Small 4', description: 'Ефективна (інструкції, логіка, код)' },
      { id: 'ministral-8b-latest', name: 'Ministral 3', description: 'Серія компактних моделей (3B, 8B, 14B)' },
      { id: 'codestral-latest', name: 'Codestral', description: 'Низьколатентна для генерації та відладки коду' },
      { id: 'open-mistral-nemo', name: 'Mistral NeMo', description: 'Компактна універсальна модель' },
    ],
  },
  {
    id: 'together',
    name: 'Together AI',
    logo: '/logos/together.png',
    description: '200+ моделей. Llama 4, Qwen 3.8, DeepSeek, тощо.',
    keyUrl: 'https://api.together.xyz/settings/api-keys',
    keyPlaceholder: '...',
    keyPrefix: '',
    freeQuota: '$1 безкоштовного кредиту',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3', description: 'Висока якість аналізу тексту та перекладу' },
      { id: 'deepseek-ai/DeepSeek-V3-0324', name: 'DeepSeek', description: 'Відкрита LLM для логіки та генерації' },
      { id: 'Qwen/Qwen3-235B-A22B', name: 'Qwen-Coder', description: 'Для написання, відладки та пошуку помилок у коді' },
      { id: 'stabilityai/stable-diffusion-xl', name: 'Stable Diffusion (SDXL)', description: 'Генерація деталізованої графіки' },
    ],
  },
];

export function getProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find(p => p.id === id);
}

export function getDefaultProvider(): AiProvider {
  return AI_PROVIDERS[0];
}
