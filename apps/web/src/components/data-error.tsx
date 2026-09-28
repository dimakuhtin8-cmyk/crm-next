'use client';

import { Button, EmptyState } from '@/components/ui';

/**
 * Единое состояние ошибки загрузки данных: текст + «Спробувати ще раз»,
 * а не пустой список. Используется вместе с lib/client-api (ApiError).
 */
export function DataError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState
      title="Не вдалося завантажити дані"
      description={message}
      action={
        <Button variant="outline" onClick={onRetry}>
          Спробувати ще раз
        </Button>
      }
    />
  );
}
