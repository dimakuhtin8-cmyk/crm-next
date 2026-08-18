import crypto from 'crypto';

import { TELEGRAM_CONFIG } from './telegram';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface TelegramAuthResult {
  success: boolean;
  user?: TelegramUser;
  error?: string;
}

export function verifyTelegramAuth(data: TelegramAuthResult): TelegramAuthResult {
  if (!TELEGRAM_CONFIG.isConfigured) {
    return { success: false, error: 'Telegram auth not configured' };
  }

  const { hash, ...userData } = data.user as TelegramUser & { hash: string };

  if (!hash) {
    return { success: false, error: 'Missing hash' };
  }

  // Check auth_date is not too old (24 hours)
  const authDate = (data.user as TelegramUser).auth_date;
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) {
    return { success: false, error: 'Auth data expired' };
  }

  // Create data check string
  const dataCheckString = Object.entries(userData)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  // Create secret key
  const secretKey = crypto.createHash('sha256').update(TELEGRAM_CONFIG.botToken).digest();

  // Calculate hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    return { success: false, error: 'Invalid hash' };
  }

  return { success: true, user: data.user as TelegramUser };
}

export async function createFirebaseTokenFromTelegram(telegramUser: TelegramUser): Promise<string> {
  const { getAuth } = await import('firebase-admin/auth');
  const uid = `telegram_${telegramUser.id}`;

  try {
    // Try to get existing user
    await getAuth().getUser(uid);
  } catch {
    // Create new user if not exists
    await getAuth().createUser({
      uid,
      displayName: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim(),
      photoURL: telegramUser.photo_url,
    });
  }

  // Create custom token
  return getAuth().createCustomToken(uid, {
    provider: 'telegram',
    telegramId: telegramUser.id,
    username: telegramUser.username,
  });
}
