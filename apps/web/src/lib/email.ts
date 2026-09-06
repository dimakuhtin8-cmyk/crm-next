/**
 * Email utilities — отправка email уведомлений
 * 
 * В dev-режиме логирует в консоль
 * В production использует SMTP/API
 */

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/uk/auth/reset-password?token=${token}`;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Password reset email to: ${email}`);
    console.log(`[DEV] Reset link: ${resetUrl}`);
    return;
  }
  
  // TODO: Implement real email sending (SMTP, Resend, SendGrid, etc.)
  // Example with Resend:
  // import { Resend } from 'resend';
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'CRM <noreply@yourdomain.com>',
  //   to: email,
  //   subject: 'Скидання пароля',
  //   html: `<p>Натисніть <a href="${resetUrl}">посилання</a> для скидання пароля</p>`,
  // });
  
  throw new Error('Email sending not configured');
}

export async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/uk/auth/verify?token=${token}`;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Magic link email to: ${email}`);
    console.log(`[DEV] Verify link: ${verifyUrl}`);
    return;
  }
  
  throw new Error('Email sending not configured');
}

export async function sendInviteEmail(email: string, inviteToken: string, tenantName: string): Promise<void> {
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/uk/invites/${inviteToken}`;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Invite email to: ${email} for tenant: ${tenantName}`);
    console.log(`[DEV] Invite link: ${inviteUrl}`);
    return;
  }
  
  throw new Error('Email sending not configured');
}
