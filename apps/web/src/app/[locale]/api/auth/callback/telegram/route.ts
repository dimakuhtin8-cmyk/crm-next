// Дубль-роут для /[locale]/api/auth/callback/telegram (UI зовёт именно его).
// Единая точка логики — /api/auth/callback/telegram (с CSRF-защитой).
// Здесь только реэкспорт, чтобы копии больше не расходились.
export { POST } from '@/app/api/auth/callback/telegram/route';
