import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

import { generateKP, generateFollowUp, analyzeContact, checkOllama } from '@/lib/ai/ollama';
import { csrfProtection } from '@/lib/csrf';
import { getTenantQuery } from '@/lib/tenant-query';

/**
 * POST /api/ai/generate — AI generation endpoint
 * Body: { action: 'kp' | 'followup' | 'analyze' | 'custom', data: {...} }
 */
export async function POST(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) return csrfError;

  try {
    const tq = await getTenantQuery(request);
    if (!tq) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });

    const isAvailable = await checkOllama();
    if (!isAvailable) {
      return NextResponse.json({ error: 'Ollama недоступна. Перевірте підключення.' }, { status: 503 });
    }

    const body = await request.json();
    const { action, data } = body;

    let result: string;

    switch (action) {
      case 'kp': {
        result = await generateKP(data);
        break;
      }
      case 'followup': {
        result = await generateFollowUp(data);
        break;
      }
      case 'analyze': {
        const { prisma } = await import('@crm-next/database');
        const activities = await prisma.activity.findMany({
          where: { contactId: data.contactId },
          orderBy: { date: 'desc' },
          take: 10,
        });
        result = await analyzeContact({
          ...data,
          activities: activities.map((a) => ({
            type: a.type,
            title: a.title,
            date: a.date.toISOString(),
          })),
        });
        break;
      }
      case 'custom': {
        const { generate } = await import('@/lib/ai/ollama');
        const genResult = await generate({
          prompt: data.prompt,
          system: data.system,
          model: data.model,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
        });
        result = genResult.response;
        break;
      }
      default:
        return NextResponse.json({ error: 'Невідома дія' }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json({ error: 'Помилка генерації' }, { status: 500 });
  }
}

/**
 * GET /api/ai/status — Check Ollama status
 */
export async function GET() {
  const isAvailable = await checkOllama();
  return NextResponse.json({ available: isAvailable });
}
