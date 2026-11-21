// Дубль-роут для /[locale]/api/auth/verify (UI зовёт именно его).
// Единая точка логики — /api/auth/verify. Здесь только реэкспорт.
export { POST } from '@/app/api/auth/verify/route';
