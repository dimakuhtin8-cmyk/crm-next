/**
 * Общий хелпер запросов для клиентских компонентов.
 * - Проверяет res.ok и бросает типизированный ApiError (не «пусто»).
 * - Единообразно разворачивает apiSuccess: { success: true, data } → data.
 * - Различает «пусто» (ok + пустой массив) и «сбой» (исключение).
 */

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status = 0, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function errorMessage(json: unknown, status: number): string {
  if (json && typeof json === 'object') {
    const err = (json as Record<string, unknown>).error;
    if (typeof err === 'string' && err) return err;
    const msg = (json as Record<string, unknown>).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  if (status === 401) return 'Не авторизовано. Увійдіть знову.';
  if (status === 403) return 'Немає доступу.';
  if (status === 404) return 'Не знайдено.';
  if (status >= 500) return 'Помилка сервера. Спробуйте ще раз.';
  return `Помилка запиту (${status}).`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'include', ...init });
  } catch {
    throw new ApiError("Помилка з'єднання. Перевірте інтернет і спробуйте ще раз.", 0);
  }
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(errorMessage(json, res.status), res.status, json);
  }
  // apiSuccess-обёртка: { success: true, data } → data. Остальное как есть.
  if (
    json &&
    typeof json === 'object' &&
    (json as Record<string, unknown>).success === true &&
    'data' in (json as Record<string, unknown>)
  ) {
    return (json as Record<string, unknown>).data as T;
  }
  return json as T;
}

/** GET JSON. Бросает ApiError при !ok или сбое сети. */
export function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  return request<T>(url, { ...init, method: 'GET' });
}

/** POST/PUT/PATCH/DELETE JSON. Бросает ApiError при !ok или сбое сети. */
export function apiSend<T>(
  url: string,
  method: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  return request<T>(url, {
    ...init,
    method,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
