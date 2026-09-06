/**
 * Reset Password API — сброс пароля по токену
 * 
 * POST /api/auth/reset-password — установить новый пароль
 */

import { NextResponse } from 'next/server';
import { prisma } from '@crm-next/database';
import { hash } from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();
    
    if (!token || !password) {
      return NextResponse.json({ success: false, error: 'Вкажіть токен та пароль' }, { status: 400 });
    }
    
    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'Пароль має бути не менше 8 символів' }, { status: 400 });
    }
    
    // Find valid token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });
    
    if (!verificationToken) {
      return NextResponse.json({ success: false, error: 'Невірний токен' }, { status: 400 });
    }
    
    // Check expiry
    if (new Date() > verificationToken.expires) {
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.json({ success: false, error: 'Токен прострочений. Запросіть нове посилання' }, { status: 400 });
    }
    
    // Extract user ID from identifier
    const userId = verificationToken.identifier.replace('password-reset:', '');
    
    // Hash new password
    const hashedPassword = await hash(password, 12);
    
    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    
    // Delete used token
    await prisma.verificationToken.delete({ where: { token } });
    
    // Invalidate all sessions for this user
    await prisma.session.deleteMany({
      where: { userId },
    });
    
    return NextResponse.json({ 
      success: true,
      message: 'Пароль успішно змінено. Увійдіть з новим паролем',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ success: false, error: 'Помилка сервера' }, { status: 500 });
  }
}
