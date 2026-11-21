// Дубль-роут для /[locale]/api/auth/register (UI зовёт именно его).
// Единая точка логики — /api/auth/register (CSRF, rate-limit, санитизация,
// обязательное согласие с офертой). Здесь только реэкспорт, чтобы копии
// больше не расходились.
export { POST } from '@/app/api/auth/register/route';
