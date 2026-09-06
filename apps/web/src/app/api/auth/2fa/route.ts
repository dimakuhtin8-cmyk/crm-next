/**
 * 2FA API — настройка и верификация TOTP (RFC 6238)
 *
 * POST /api/auth/2fa?action=setup  — создать секрет (pending, 2FA НЕ включается)
 * POST /api/auth/2fa?action=verify — подтвердить кодом из приложения → включает 2FA
 * POST /api/auth/2fa?action=disable — отключить 2FA (требует текущий валидный код)
 * POST /api/auth/2fa?action=status — статус 2FA
 *
 * Секреты хранятся в БД зашифрованными (encrypt()), включается 2FA только
 * после подтверждения владением. Действующий код клиенту НЕ возвращается.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@crm-next/database';
import { encrypt, decrypt } from '@/lib/encryption';
import { generateTOTPSecret, verifyTOTP } from '@/lib/totp';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'setup';

    // Get user from session
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/authjs\.session-token=([^;]+)/);
    if (!tokenMatch) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(tokenMatch[1], secret);
    const userId = payload.id as string;
    const tenantId = payload.tenantId as string;

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    switch (action) {
      case 'setup': {
        const totpSecret = generateTOTPSecret();
        // Store encrypted, NOT enabled — activation requires confirm below.
        // Never return a working code to the client.
        await prisma.user.update({
          where: { id: userId },
          data: { twoFactorSecret: encrypt(totpSecret), twoFactorEnabled: false },
        });

        const issuer = 'CRM-Next';
        const account = (payload.email as string) || userId;
        const otpauthUrl =
          `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
          `?secret=${totpSecret}&issuer=${encodeURIComponent(issuer)}`;

        return NextResponse.json({
          secret: totpSecret,
          otpauthUrl,
          message: 'Відскануйте QR-код або введіть секрет у додаток автентифікації, потім підтвердіть кодом',
        });
      }

      case 'verify': {
        const { token } = body as { token?: unknown };

        if (!token || typeof token !== 'string') {
          return NextResponse.json({ error: 'Введіть код з додатку' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { twoFactorSecret: true },
        });
        if (!user?.twoFactorSecret) {
          return NextResponse.json({ error: 'Спочатку ініціалізуйте 2FA' }, { status: 400 });
        }

        const isValid = verifyTOTP(decrypt(user.twoFactorSecret), token);
        if (!isValid) {
          return NextResponse.json({ error: 'Невірний код. Перевірте час на пристрої' }, { status: 400 });
        }

        await prisma.user.update({
          where: { id: userId },
          data: { twoFactorEnabled: true },
        });
        return NextResponse.json({ success: true, message: '2FA успішно увімкнено' });
      }

      case 'disable': {
        const { token } = body as { token?: unknown };

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { twoFactorSecret: true, twoFactorEnabled: true },
        });
        if (!user?.twoFactorSecret || !user.twoFactorEnabled) {
          return NextResponse.json({ error: '2FA не увімкнено' }, { status: 400 });
        }

        // Token is MANDATORY — passwordless disable is not allowed.
        if (!token || typeof token !== 'string' || !verifyTOTP(decrypt(user.twoFactorSecret), token)) {
          return NextResponse.json({ error: 'Невірний код' }, { status: 400 });
        }

        await prisma.user.update({
          where: { id: userId },
          data: { twoFactorSecret: null, twoFactorEnabled: false },
        });

        return NextResponse.json({ success: true, message: '2FA вимкнено' });
      }

      case 'status': {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { twoFactorSecret: true, twoFactorEnabled: true },
        });
        return NextResponse.json({ enabled: !!(user?.twoFactorSecret && user.twoFactorEnabled) });
      }

      default:
        return NextResponse.json({ error: 'Невідома дія' }, { status: 400 });
    }
  } catch (error) {
    console.error('2FA error:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}
