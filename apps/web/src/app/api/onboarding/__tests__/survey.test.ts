// Опитування онбордингу: пресет воронки по сфері, збереження відповідей, скіп.

import { prisma } from '@crm-next/database';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('@/auth/config', () => ({ auth: vi.fn(async () => null) }));

import { POST as onboardingPOST } from '@/app/api/onboarding/route';
import { auth } from '@/auth/config';
import { DEFAULT_STAGES, STAGE_PRESETS } from '@/lib/onboarding/survey';

const mockedAuth = auth as unknown as { mockResolvedValue: (v: unknown) => void };

function post(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost:3000/api/onboarding'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const SURVEY = {
  industry: 'trade',
  industryCustom: null,
  role: 'owner',
  roleCustom: null,
  experience: 'none',
  experienceText: null,
  priorityTask: 'leads',
  priorityCustom: null,
};

async function mkUser(email: string) {
  return prisma.user.create({ data: { email, name: email } });
}

beforeAll(async () => {
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

afterAll(async () => {
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('опитування онбордингу', () => {
  it('новачок з опитуванням: пресет торгівлі + відповіді в settings', async () => {
    const u = await mkUser('survey-new@test.com');
    mockedAuth.mockResolvedValue({ user: { id: u.id } });

    const r = await onboardingPOST(
      post({ companyName: 'Trade Co', pipelineStages: STAGE_PRESETS.trade, survey: SURVEY }),
    );
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);

    const member = await prisma.tenantMember.findFirst({ where: { userId: u.id } });
    const tenant = await prisma.tenant.findUnique({ where: { id: member!.tenantId } });
    const settings = JSON.parse(tenant!.settings || '{}');
    expect(settings.onboarding.industry).toBe('trade');
    expect(settings.onboarding.role).toBe('owner');
    expect(settings.onboarding.priorityTask).toBe('leads');
    expect(typeof settings.onboarding.completedAt).toBe('string');

    const stages = await prisma.pipelineStage.findMany({
      where: { pipeline: { tenantId: member!.tenantId } },
      orderBy: { order: 'asc' },
    });
    expect(stages.map((s) => s.name)).toEqual(STAGE_PRESETS.trade);
  });

  it('скіп без опитування: дефолтна воронка, без ключа onboarding', async () => {
    const u = await mkUser('survey-skip@test.com');
    mockedAuth.mockResolvedValue({ user: { id: u.id } });

    const r = await onboardingPOST(
      post({ companyName: 'Skip Co', pipelineStages: DEFAULT_STAGES, survey: null }),
    );
    expect(r.status).toBe(200);

    const member = await prisma.tenantMember.findFirst({ where: { userId: u.id } });
    const tenant = await prisma.tenant.findUnique({ where: { id: member!.tenantId } });
    const settings = tenant!.settings ? JSON.parse(tenant!.settings) : {};
    expect(settings.onboarding).toBeUndefined();

    const stages = await prisma.pipelineStage.findMany({
      where: { pipeline: { tenantId: member!.tenantId } },
      orderBy: { order: 'asc' },
    });
    expect(stages.map((s) => s.name)).toEqual(DEFAULT_STAGES);
  });

  it('невалідна сфера → 400', async () => {
    const u = await mkUser('survey-bad@test.com');
    mockedAuth.mockResolvedValue({ user: { id: u.id } });

    const r = await onboardingPOST(
      post({
        companyName: 'Bad Co',
        pipelineStages: DEFAULT_STAGES,
        survey: { ...SURVEY, industry: 'farming' },
      }),
    );
    expect(r.status).toBe(400);
  });

  it('запрошений учасник: опитування чужі налаштування не чіпає', async () => {
    const owner = await mkUser('survey-team-owner@test.com');
    mockedAuth.mockResolvedValue({ user: { id: owner.id } });
    await onboardingPOST(
      post({ companyName: 'Team Co', pipelineStages: DEFAULT_STAGES, survey: null }),
    );
    const membership = await prisma.tenantMember.findFirst({ where: { userId: owner.id } });

    const memberUser = await mkUser('survey-team-member@test.com');
    await prisma.tenantMember.create({
      data: { userId: memberUser.id, tenantId: membership!.tenantId, role: 'member' },
    });
    mockedAuth.mockResolvedValue({ user: { id: memberUser.id } });

    const r = await onboardingPOST(post({ companyName: '', pipelineStages: [], survey: SURVEY }));
    expect(r.status).toBe(200);

    const tenant = await prisma.tenant.findUnique({ where: { id: membership!.tenantId } });
    const settings = tenant!.settings ? JSON.parse(tenant!.settings) : {};
    expect(settings.onboarding).toBeUndefined();
  });
});
