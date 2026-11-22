/**
 * Ключи человекочитаемых сообщений об ошибках авторизации (коды NextAuth →
 * ключи словаря i18n). Сырые коды вида "CredentialsSignin" пользователю
 * не показываем.
 */
export const AUTH_ERROR_KEYS: Record<string, string> = {
  Configuration: 'auth.errors.configuration',
  AccessDenied: 'auth.errors.accessDenied',
  Verification: 'auth.errors.verification',
  CredentialsSignin: 'auth.errors.credentials',
  SessionRequired: 'auth.errors.sessionRequired',
};

/** Код ошибки → ключ сообщения в словаре (fallback — общее сообщение). */
export function authErrorKey(code?: string | null): string {
  return (code && AUTH_ERROR_KEYS[code]) || 'auth.errors.default';
}
