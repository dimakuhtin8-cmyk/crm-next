/**
 * Email utilities — отправка через Resend REST API (без SDK).
 *
 * В dev-режиме без RESEND_API_KEY — только лог в консоль, без исключений,
 * чтобы локальная разработка не падала.
 */

interface SendParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

async function sendViaResend(params: SendParams): Promise<{ id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Email to: ${Array.isArray(params.to) ? params.to.join(', ') : params.to}`);
      console.log(`[DEV] Subject: ${params.subject}`);
      return {};
    }
    throw new Error('RESEND_API_KEY не налаштовано');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'CRM <onboarding@resend.dev>',
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    throw new Error(`Resend HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return { id: body.id };
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/uk/auth/reset-password?token=${token}`;
  await sendViaResend({
    to: email,
    subject: 'Скидання пароля',
    html: `<p>Натисніть <a href="${resetUrl}">посилання</a> для скидання пароля. Посилання дійсне 1 годину.</p>`,
  });
}

export async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/uk/auth/verify?token=${token}`;
  await sendViaResend({
    to: email,
    subject: 'Вхід в CRM',
    html: `<p>Натисніть <a href="${verifyUrl}">посилання</a> для входу. Посилання дійсне 15 хвилин.</p>`,
  });
}

export async function sendInviteEmail(email: string, inviteToken: string, tenantName: string): Promise<void> {
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/uk/invites/${inviteToken}`;
  await sendViaResend({
    to: email,
    subject: `Запрошення в ${tenantName}`,
    html: `<p>Вас запросили в команду "${tenantName}". Прийняти: <a href="${inviteUrl}">посилання</a>.</p>`,
  });
}
