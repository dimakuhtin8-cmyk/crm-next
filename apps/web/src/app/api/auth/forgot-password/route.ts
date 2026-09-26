/**
 * Forgot Password API — отправка ссылки для сброса пароля
 * 
 * POST /api/auth/forgot-password — отправить email с ссылкой
 */

import { NextResponse } from 'next/server';
import { prisma } from '@crm-next/database';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ success: false, error: 'Вкажіть email' }, { status: 400 });
    }
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    // Always return success to prevent email enumeration
    if (!user || !user.email) {
      return NextResponse.json({ 
        success: true, 
        message: 'Якщо email зареєстровано, посилання буде надіслано' 
      });
    }
    
    // Generate token
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour
    
    // Delete old tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: `password-reset:${user.id}`,
      },
    });
    
    // Store token
    await prisma.verificationToken.create({
      data: {
        identifier: `password-reset:${user.id}`,
        token,
        expires,
      },
    });
    
    // Send email (with fallback for dev)
    try {
      await sendPasswordResetEmail(user.email, token);
    } catch (emailError) {
      // In dev, log the link
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV] Password reset link: http://localhost:3000/uk/auth/reset-password?token=${token}`);
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Якщо email зареєстровано, посилання буде надіслано',
      // Only in dev, return the link
      ...(process.env.NODE_ENV === 'development' && {
        debugLink: `http://localhost:3000/uk/auth/reset-password?token=${token}`,
      }),
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ success: false, error: 'Помилка сервера' }, { status: 500 });
  }
}
