/**
 * Тимчасовий ендпоінт синхронізації схеми. ВИДАЛИТИ після міграції прод-БД.
 *
 * Чому він існує: коміт 647403d додав колонку `User.termsAcceptedAt`,
 * а `prisma db push` на прод-БД не виконувався (доступу до DATABASE_URL
 * немає — у Vercel це write-only Secret). Через це будь-який SELECT
 * моделі User кидає помилку: зламані вхід, реєстрація та forgot-password.
 *
 * Ендпоінт виконує рівно одну ідемпотентну команду без вхідних даних
 * (ALTER TABLE ... ADD COLUMN IF NOT EXISTS) і повертає лише коди стану —
 * без повідомлень помилок, даних користувачів та stack trace.
 */
import { prisma } from '@crm-next/database';
import { NextResponse } from 'next/server';

const TABLE = 'User';
const COLUMN = 'termsAcceptedAt';
/** Значення підтвердження — не секрет, лише захист від випадкових запитів. */
const CONFIRM = 'add-terms-accepted-at';

interface EnsureResult {
  ok: boolean;
  reason?:
    'invalid_body' | 'table_missing' | 'column_missing_after' | 'user_query_failed' | 'internal';
  columnBefore?: boolean;
  columnAfter?: boolean;
  /** Код помилки Prisma (напр. P2022), якщо є — сам текст не повертається. */
  code?: string;
}

/** Перевіряє наявність таблиці та колонки через information_schema. */
async function schemaState(): Promise<{ tableExists: boolean; columnExists: boolean }> {
  const rows = await prisma.$queryRaw<Array<{ table_exists: boolean; column_exists: boolean }>>`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${TABLE}
      ) AS table_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${TABLE} AND column_name = ${COLUMN}
      ) AS column_exists
  `;
  const row = rows[0];
  return {
    tableExists: Boolean(row?.table_exists),
    columnExists: Boolean(row?.column_exists),
  };
}

export async function POST(request: Request): Promise<NextResponse<EnsureResult>> {
  let confirm: unknown;
  try {
    const body = (await request.json()) as { confirm?: unknown };
    confirm = body.confirm;
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_body' }, { status: 400 });
  }
  if (confirm !== CONFIRM) {
    return NextResponse.json({ ok: false, reason: 'invalid_body' }, { status: 400 });
  }

  try {
    const before = await schemaState();

    if (!before.tableExists) {
      // Таблиці немає — гіпотеза про причину не підтвердилася.
      return NextResponse.json({ ok: false, reason: 'table_missing', columnBefore: false });
    }

    if (!before.columnExists) {
      // Константи з модуля, вхідних даних у SQL немає.
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "${COLUMN}" TIMESTAMP(3)`,
      );
    }

    const after = await schemaState();
    if (!after.columnExists) {
      return NextResponse.json({
        ok: false,
        reason: 'column_missing_after',
        columnBefore: before.columnExists,
        columnAfter: false,
      });
    }

    // Той самий запит, що й у authorize/ forgot-password: SELECT усіх полів User.
    // Результат відкидаємо — у відповідь потрапляє лише булеве значення.
    await prisma.user.findFirst({ take: 1 });

    return NextResponse.json({
      ok: true,
      columnBefore: before.columnExists,
      columnAfter: true,
    });
  } catch (err: unknown) {
    const code =
      err &&
      typeof err === 'object' &&
      'code' in err &&
      typeof (err as { code?: unknown }).code === 'string'
        ? (err as { code: string }).code
        : undefined;
    return NextResponse.json({ ok: false, reason: 'internal', code }, { status: 500 });
  }
}
