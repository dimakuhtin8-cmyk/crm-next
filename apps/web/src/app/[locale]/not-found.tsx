import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-2xl font-bold">Сторінку не знайдено</h2>
        <p className="mt-2 text-foreground-secondary">
          Сторінка, яку ви шукаєте, не існує або була переміщена.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-glow hover:bg-primary-hover transition-colors"
        >
          Повернутися на головну
        </Link>
      </div>
    </div>
  );
}