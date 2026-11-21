// Дубль-роут для /[locale]/api/auth/[...nextauth].
// Единая точка логики — /api/auth/[...nextauth]. Здесь только реэкспорт.
export { GET, POST } from '@/app/api/auth/[...nextauth]/route';
