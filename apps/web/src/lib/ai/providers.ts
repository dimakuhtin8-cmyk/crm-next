export interface AiProvider {
  id: string;
  name: string;
  logo: string;
  /** Ключ перекладу next-intl (див. command-palette-logic.ts: render sites use tRoot(...)). */
  description: string;
  keyUrl: string;
  keyPlaceholder: string;
  keyPrefix: string;
  /** Extra accepted prefixes (Google also issues AQ.* keys). */
  keyPrefixes?: string[];
  models: AiModel[];
  freeQuota: string;
}

export interface AiModel {
  id: string;
  name: string;
  /** Ключ перекладу next-intl (render sites use tRoot(...)). */
  description: string;
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    logo: '/logos/gemini.webp',
    description: 'aiProviders.gemini.description',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIza... / AQ....',
    keyPrefix: 'AIza',
    keyPrefixes: ['AIza', 'AQ.'],
    freeQuota: 'aiProviders.gemini.freeQuota',
    models: [
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        description: 'aiProviders.gemini.models.gemini-3-flash-preview.description',
      },
      {
        id: 'gemini-3.5-flash-lite',
        name: 'Gemini 3.5 Flash-Lite',
        description: 'aiProviders.gemini.models.gemini-3-5-flash-lite.description',
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro',
        description: 'aiProviders.gemini.models.gemini-3-1-pro-preview.description',
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    logo: '/logos/openai.webp',
    description: 'aiProviders.openai.description',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-...',
    keyPrefix: 'sk-',
    freeQuota: 'aiProviders.openai.freeQuota',
    models: [
      {
        id: 'gpt-5.6-sol',
        name: 'GPT-5.6 Sol',
        description: 'aiProviders.openai.models.gpt-5-6-sol.description',
      },
      {
        id: 'gpt-5.6-terra',
        name: 'GPT-5.6 Terra',
        description: 'aiProviders.openai.models.gpt-5-6-terra.description',
      },
      {
        id: 'gpt-5.6-luna',
        name: 'GPT-5.6 Luna',
        description: 'aiProviders.openai.models.gpt-5-6-luna.description',
      },
      {
        id: 'gpt-5.3-codex',
        name: 'GPT-5.3-Codex',
        description: 'aiProviders.openai.models.gpt-5-3-codex.description',
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    logo: '/logos/anthropic.webp',
    description: 'aiProviders.anthropic.description',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-...',
    keyPrefix: 'sk-ant-',
    freeQuota: 'aiProviders.anthropic.freeQuota',
    models: [
      {
        id: 'claude-opus-5',
        name: 'Fable 5 (Pro)',
        description: 'aiProviders.anthropic.models.claude-opus-5.description',
      },
      {
        id: 'claude-opus-4',
        name: 'Opus 5 (Pro)',
        description: 'aiProviders.anthropic.models.claude-opus-4.description',
      },
      {
        id: 'claude-sonnet-4',
        name: 'Sonnet 5',
        description: 'aiProviders.anthropic.models.claude-sonnet-4.description',
      },
      {
        id: 'claude-haiku-4-5',
        name: 'Haiku 4.5',
        description: 'aiProviders.anthropic.models.claude-haiku-4-5.description',
      },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: '/logos/deepseek.jpg',
    description: 'aiProviders.deepseek.description',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyPlaceholder: 'sk-...',
    keyPrefix: 'sk-',
    freeQuota: 'aiProviders.deepseek.freeQuota',
    models: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat (V3)',
        description: 'aiProviders.deepseek.models.deepseek-chat.description',
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner (R1)',
        description: 'aiProviders.deepseek.models.deepseek-reasoner.description',
      },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    logo: '/logos/groq.png',
    description: 'aiProviders.groq.description',
    keyUrl: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
    keyPrefix: 'gsk_',
    freeQuota: 'aiProviders.groq.freeQuota',
    models: [
      {
        id: 'openai/gpt-oss-120b',
        name: 'GPT-OSS 120B',
        description: 'aiProviders.groq.models.openai-gpt-oss-120b.description',
      },
      {
        id: 'openai/gpt-oss-20b',
        name: 'GPT-OSS 20B',
        description: 'aiProviders.groq.models.openai-gpt-oss-20b.description',
      },
      {
        id: 'qwen/qwen3.6-27b',
        name: 'Qwen 3.6 27B',
        description: 'aiProviders.groq.models.qwen-qwen3-6-27b.description',
      },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    logo: '/logos/mistral.webp',
    description: 'aiProviders.mistral.description',
    keyUrl: 'https://console.mistral.ai/api-keys/',
    keyPlaceholder: 'mist-...',
    keyPrefix: 'mist-',
    freeQuota: 'aiProviders.mistral.freeQuota',
    models: [
      {
        id: 'mistral-large-latest',
        name: 'Mistral Large 3',
        description: 'aiProviders.mistral.models.mistral-large-latest.description',
      },
      {
        id: 'mistral-small-latest',
        name: 'Mistral Small 4',
        description: 'aiProviders.mistral.models.mistral-small-latest.description',
      },
      {
        id: 'ministral-8b-latest',
        name: 'Ministral 3',
        description: 'aiProviders.mistral.models.ministral-8b-latest.description',
      },
      {
        id: 'codestral-latest',
        name: 'Codestral',
        description: 'aiProviders.mistral.models.codestral-latest.description',
      },
      {
        id: 'open-mistral-nemo',
        name: 'Mistral NeMo',
        description: 'aiProviders.mistral.models.open-mistral-nemo.description',
      },
    ],
  },
  {
    id: 'together',
    name: 'Together AI',
    logo: '/logos/together.png',
    description: 'aiProviders.together.description',
    keyUrl: 'https://api.together.xyz/settings/api-keys',
    keyPlaceholder: '...',
    keyPrefix: '',
    freeQuota: 'aiProviders.together.freeQuota',
    models: [
      {
        id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        name: 'Llama 3.3',
        description:
          'aiProviders.together.models.meta-llama-Llama-3-3-70B-Instruct-Turbo.description',
      },
      {
        id: 'deepseek-ai/DeepSeek-V3-0324',
        name: 'DeepSeek',
        description: 'aiProviders.together.models.deepseek-ai-DeepSeek-V3-0324.description',
      },
      {
        id: 'Qwen/Qwen3-235B-A22B',
        name: 'Qwen-Coder',
        description: 'aiProviders.together.models.Qwen-Qwen3-235B-A22B.description',
      },
      {
        id: 'stabilityai/stable-diffusion-xl',
        name: 'Stable Diffusion (SDXL)',
        description: 'aiProviders.together.models.stabilityai-stable-diffusion-xl.description',
      },
    ],
  },
];

export function getProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

export function getDefaultProvider(): AiProvider {
  return AI_PROVIDERS[0];
}
