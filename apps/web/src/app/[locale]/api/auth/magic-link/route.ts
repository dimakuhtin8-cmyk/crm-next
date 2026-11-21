// Дубль-роут для /[locale]/api/auth/magic-link (UI зовёт именно его).
// Единая точка логики — /api/auth/magic-link (CSRF, rate-limit, без утечки
// ссылки в ответ). Здесь только реэкспорт.
export { POST } from '@/app/api/auth/magic-link/route';
