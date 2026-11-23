/**
 * Import/actualization engine (src/lib/import/upsert) — інтеграційний тест
 * (реальный engine + реальная БД crm_test). Паттерн скопирован с
 * app/api/contacts/__tests__/datafilter.test.ts.
 */

import { prisma } from '@crm-next/database';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { encrypt } from '@/lib/encryption';
import { upsertContacts, upsertDeals, upsertTasks } from '@/lib/import/upsert';

let tenantId: string;
let otherTenantId: string;
let userId: string;
let pipelineId: string;
let firstStageId: string;

beforeAll(async () => {
  // Cleanup in reverse FK order
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: { name: 'Import Tenant', slug: 'test-import-engine', plan: 'professional' },
  });
  tenantId = tenant.id;

  const other = await prisma.tenant.create({
    data: { name: 'Other Tenant', slug: 'test-import-other', plan: 'professional' },
  });
  otherTenantId = other.id;

  const user = await prisma.user.create({
    data: { email: 'importer@test.com', name: 'Importer' },
  });
  userId = user.id;
  await prisma.tenantMember.create({
    data: { userId, tenantId, role: 'member' },
  });

  const pipeline = await prisma.pipeline.create({
    data: {
      tenantId,
      name: 'Основна воронка',
      isDefault: true,
      stages: {
        create: [
          { name: 'етап 1', order: 1 },
          { name: 'етап 2', order: 2 },
        ],
      },
    },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
  pipelineId = pipeline.id;
  firstStageId = pipeline.stages[0].id;
});

afterAll(async () => {
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('upsertContacts — matching', () => {
  it('upsert: externalId match updates the record instead of creating a duplicate', async () => {
    const mapping = { firstName: "Ім'я", email: 'Email', externalId: 'Код' };

    const first = await upsertContacts(
      tenantId,
      userId,
      [{ Код: 'EXT-1', "Ім'я": 'Перший', Email: 'ext1@x.com' }],
      'upsert',
      mapping,
    );
    expect(first).toMatchObject({ created: 1, updated: 0, skipped: 0, errors: [] });

    // Re-import with the same externalId but a changed name and no email cell:
    // the record is updated, not duplicated, and the empty cell keeps email.
    const second = await upsertContacts(
      tenantId,
      userId,
      [{ Код: 'EXT-1', "Ім'я": 'Другий', Email: '' }],
      'upsert',
      mapping,
    );
    expect(second).toMatchObject({ created: 0, updated: 1, skipped: 0, errors: [] });

    const matches = await prisma.contact.findMany({
      where: { tenantId, externalId: 'EXT-1' },
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].firstName).toBe('Другий');
    expect(matches[0].email).toBe('ext1@x.com');
  });

  it('create: rows matching an existing contact by email (case-insensitive) are skipped', async () => {
    await prisma.contact.create({
      data: { tenantId, firstName: 'EmailDup', email: 'dup@example.com' },
    });

    const report = await upsertContacts(
      tenantId,
      userId,
      [{ name: 'Новий', mail: 'DUP@Example.com' }],
      'create',
      { firstName: 'name', email: 'mail' },
    );
    expect(report).toMatchObject({ created: 0, updated: 0, skipped: 1, errors: [] });

    const duplicated = await prisma.contact.findMany({
      where: { tenantId, firstName: 'Новий' },
    });
    expect(duplicated).toHaveLength(0);
  });

  it('create: rows matching by phone digits are skipped (phone stored encrypted)', async () => {
    await prisma.contact.create({
      data: { tenantId, firstName: 'PhoneDup', phone: encrypt('+38 (067) 111-22-33') },
    });

    const report = await upsertContacts(
      tenantId,
      userId,
      [{ name: 'Фоновий', tel: '38067 111 22 33' }],
      'create',
      { firstName: 'name', phone: 'tel' },
    );
    expect(report).toMatchObject({ created: 0, updated: 0, skipped: 1, errors: [] });

    const duplicated = await prisma.contact.findMany({
      where: { tenantId, firstName: 'Фоновий' },
    });
    expect(duplicated).toHaveLength(0);
  });

  it('upsert: match by email stores externalId, later runs match by externalId', async () => {
    const fixture = await prisma.contact.create({
      data: { tenantId, firstName: 'Ланка', email: 'chain@x.com' },
    });

    const byEmail = await upsertContacts(
      tenantId,
      userId,
      [{ Код: 'EXT-CH', "Ім'я": 'Ланка 2', mail: 'chain@x.com' }],
      'upsert',
      { firstName: "Ім'я", email: 'mail', externalId: 'Код' },
    );
    expect(byEmail).toMatchObject({ created: 0, updated: 1, errors: [] });

    const byExternalId = await upsertContacts(
      tenantId,
      userId,
      [{ Код: 'EXT-CH', "Ім'я": 'Ланка 3' }],
      'upsert',
      { firstName: "Ім'я", externalId: 'Код' },
    );
    expect(byExternalId).toMatchObject({ created: 0, updated: 1, errors: [] });

    const matches = await prisma.contact.findMany({
      where: { tenantId, email: 'chain@x.com' },
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(fixture.id);
    expect(matches[0].firstName).toBe('Ланка 3');
    expect(matches[0].externalId).toBe('EXT-CH');
  });

  it('rows missing the required firstName are reported, other rows continue', async () => {
    const report = await upsertContacts(
      tenantId,
      userId,
      [{ "Ім'я": 'Ок 1' }, { "Ім'я": '' }, { "Ім'я": 'Ок 2' }],
      'create',
      { firstName: "Ім'я" },
    );
    expect(report.created).toBe(2);
    expect(report.skipped).toBe(0);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].row).toBe(2);
    expect(report.errors[0].message).toContain('firstName');
  });

  it('tenant isolation: records of another tenant are never matched', async () => {
    await prisma.contact.create({
      data: {
        tenantId: otherTenantId,
        firstName: 'Чужий',
        externalId: 'EXT-ISO',
        email: 'iso@other.com',
        phone: encrypt('380501234567'),
      },
    });

    // Same externalId/email/phone as the other tenant's contact — must
    // create a NEW record here, never update the foreign one.
    const report = await upsertContacts(
      tenantId,
      userId,
      [{ Код: 'EXT-ISO', "Ім'я": 'Свій', mail: 'iso@other.com', tel: '380 50 123 45 67' }],
      'upsert',
      { firstName: "Ім'я", email: 'mail', phone: 'tel', externalId: 'Код' },
    );
    expect(report).toMatchObject({ created: 1, updated: 0, skipped: 0, errors: [] });

    const foreign = await prisma.contact.findMany({
      where: { tenantId: otherTenantId, externalId: 'EXT-ISO' },
    });
    expect(foreign).toHaveLength(1);
    expect(foreign[0].firstName).toBe('Чужий');

    const own = await prisma.contact.findMany({
      where: { tenantId, externalId: 'EXT-ISO' },
    });
    expect(own).toHaveLength(1);
    expect(own[0].firstName).toBe('Свій');
  });
});

describe('upsertDeals', () => {
  it('create: uses the tenant first pipeline and its first stage when none is mapped', async () => {
    const report = await upsertDeals(
      tenantId,
      userId,
      [{ Назва: 'Угода A', Сума: '1 234,56', Валюта: 'USD', Код: 'D-1' }],
      'create',
      { title: 'Назва', value: 'Сума', currency: 'Валюта', externalId: 'Код' },
    );
    expect(report).toMatchObject({ created: 1, updated: 0, skipped: 0, errors: [] });

    const deal = await prisma.deal.findFirst({ where: { tenantId, externalId: 'D-1' } });
    expect(deal).not.toBeNull();
    expect(deal?.title).toBe('Угода A');
    expect(deal?.value).toBe(1234.56);
    expect(deal?.currency).toBe('USD');
    expect(deal?.pipelineId).toBe(pipelineId);
    expect(deal?.stageId).toBe(firstStageId);
    expect(deal?.ownerId).toBe(userId);
    expect(deal?.status).toBe('open');
  });

  it('upsert: matches by externalId, then by exact title — never duplicates', async () => {
    const byExternalId = await upsertDeals(
      tenantId,
      userId,
      [{ Код: 'D-1', Назва: 'Угода A new', Сума: '999' }],
      'upsert',
      { title: 'Назва', value: 'Сума', externalId: 'Код' },
    );
    expect(byExternalId).toMatchObject({ created: 0, updated: 1, errors: [] });

    const byTitle = await upsertDeals(
      tenantId,
      userId,
      [{ Назва: 'Угода A new', Сума: '500' }],
      'upsert',
      { title: 'Назва', value: 'Сума' },
    );
    expect(byTitle).toMatchObject({ created: 0, updated: 1, errors: [] });

    const deals = await prisma.deal.findMany({ where: { tenantId } });
    expect(deals).toHaveLength(1);
    expect(deals[0].title).toBe('Угода A new');
    expect(deals[0].value).toBe(500);
  });

  it('create: rows matching an existing deal by title are skipped', async () => {
    const report = await upsertDeals(tenantId, userId, [{ Назва: 'Угода A new' }], 'create', {
      title: 'Назва',
    });
    expect(report).toMatchObject({ created: 0, updated: 0, skipped: 1, errors: [] });
  });

  it('malformed rows are reported with their row number, others continue', async () => {
    const report = await upsertDeals(
      tenantId,
      userId,
      [{ Назва: '' }, { Назва: 'Угода B', Сума: 'abc' }],
      'create',
      { title: 'Назва', value: 'Сума' },
    );
    expect(report.created).toBe(0);
    expect(report.errors).toHaveLength(2);
    expect(report.errors[0]).toMatchObject({ row: 1 });
    expect(report.errors[0].message).toContain('title');
    expect(report.errors[1]).toMatchObject({ row: 2 });
    expect(report.errors[1].message).toContain('Invalid number');
  });

  it('without a pipeline the row is skipped with a message', async () => {
    const report = await upsertDeals(otherTenantId, userId, [{ Назва: 'Угода X' }], 'create', {
      title: 'Назва',
    });
    expect(report.created).toBe(0);
    expect(report.skipped).toBe(1);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].message).toContain('pipeline');

    const deals = await prisma.deal.findMany({ where: { tenantId: otherTenantId } });
    expect(deals).toHaveLength(0);
  });

  it('mapped pipelineId is respected; unknown pipelineId is an error row', async () => {
    const ok = await upsertDeals(
      tenantId,
      userId,
      [{ Назва: 'Угода C', Пайплайн: pipelineId, Етап: firstStageId }],
      'create',
      { title: 'Назва', pipelineId: 'Пайплайн', stageId: 'Етап' },
    );
    expect(ok).toMatchObject({ created: 1, errors: [] });

    const bad = await upsertDeals(
      tenantId,
      userId,
      [{ Назва: 'Угода D', Пайплайн: 'nope' }],
      'create',
      { title: 'Назва', pipelineId: 'Пайплайн' },
    );
    expect(bad.created).toBe(0);
    expect(bad.errors).toHaveLength(1);
    expect(bad.errors[0].message).toContain('Pipeline not found');
  });
});

describe('upsertTasks', () => {
  it('parses dd.mm.yyyy and ISO dueDate', async () => {
    const report = await upsertTasks(
      tenantId,
      userId,
      [
        { Назва: 'Задача 1', Код: 'T-1', Термін: '15.03.2026' },
        { Назва: 'Задача 2', Термін: '2026-03-20T10:30:00Z' },
      ],
      'create',
      { title: 'Назва', externalId: 'Код', dueDate: 'Термін' },
    );
    expect(report).toMatchObject({ created: 2, updated: 0, skipped: 0, errors: [] });

    const task1 = await prisma.task.findFirst({ where: { tenantId, title: 'Задача 1' } });
    expect(task1?.dueDate?.getTime()).toBe(new Date(2026, 2, 15).getTime());
    expect(task1?.assigneeId).toBe(userId);

    const task2 = await prisma.task.findFirst({ where: { tenantId, title: 'Задача 2' } });
    expect(task2?.dueDate?.toISOString()).toBe('2026-03-20T10:30:00.000Z');
  });

  it('upsert by externalId updates the task; create mode skips by title', async () => {
    const updated = await upsertTasks(
      tenantId,
      userId,
      [{ Код: 'T-1', Назва: 'Задача 1 нова', Пріоритет: 'high' }],
      'upsert',
      { title: 'Назва', externalId: 'Код', priority: 'Пріоритет' },
    );
    expect(updated).toMatchObject({ created: 0, updated: 1, errors: [] });

    const skipped = await upsertTasks(tenantId, userId, [{ Назва: 'Задача 1 нова' }], 'create', {
      title: 'Назва',
    });
    expect(skipped).toMatchObject({ created: 0, updated: 0, skipped: 1, errors: [] });

    const tasks = await prisma.task.findMany({ where: { tenantId, externalId: 'T-1' } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Задача 1 нова');
    expect(tasks[0].priority).toBe('high');
  });

  it('unparseable dueDate is an error row', async () => {
    const report = await upsertTasks(
      tenantId,
      userId,
      [{ Назва: 'Задача 3', Термін: '31.02.2026' }],
      'create',
      { title: 'Назва', dueDate: 'Термін' },
    );
    expect(report.created).toBe(0);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].message).toContain('dueDate');
  });

  it('tenant isolation: task titles are matched within the tenant only', async () => {
    const report = await upsertTasks(
      otherTenantId,
      userId,
      [{ Назва: 'Задача 1 нова' }],
      'create',
      { title: 'Назва' },
    );
    expect(report).toMatchObject({ created: 1, skipped: 0, errors: [] });
  });
});
