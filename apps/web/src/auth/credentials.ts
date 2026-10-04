import { prisma } from '@crm-next/database';
import { compare } from 'bcryptjs';

/**
 * Перевірка email+пароля для Credentials-провайдера Auth.js.
 * Єдине місце політики входу: старі короткі паролі не блокуються
 * (ліміт 8 символів діє лише при створенні/сміні).
 * Повертає користувача або null. Окремий модуль без next-auth,
 * щоб юніт-тести не тягнули серверний рантайм.
 */
export async function authorizeCredentials(
  email: string,
  password: string,
): Promise<{ id: string; email: string; name: string | null; image: string | null } | null> {
  if (!email || !password) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) return null;
  const valid = await compare(password, user.password);
  if (!valid) return null;
  return {
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? null,
    image: user.image ?? null,
  };
}
