/**
 * Человекочитаемые сообщения об ошибках авторизации (коды NextAuth → uk).
 * Сырые коды вида "CredentialsSignin" пользователю не показываем.
 */
export const AUTH_ERRORS: Record<string, string> = {
  Configuration: 'Помилка конфігурації сервера. Зверніться до адміністратора.',
  AccessDenied: 'Доступ відхилено.',
  Verification: 'Посилання для верифікації вже використане або прострочене.',
  CredentialsSignin: 'Невірний email або пароль.',
  SessionRequired: 'Спочатку увійдіть в акаунт.',
  Default: 'Помилка авторизації. Спробуйте ще раз.',
};

/** Код ошибки → понятное сообщение (fallback — общее сообщение). */
export function friendlyAuthError(code?: string | null): string {
  return (code && AUTH_ERRORS[code]) || AUTH_ERRORS.Default;
}
