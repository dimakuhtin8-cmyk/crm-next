/**
 * Error Boundary — ловит ошибки рендеринга
 * 
 * Используется для:
 * - Обработки ошибок в React компонентах
 * - Показа красивого экрана ошибки
 * - Предоставления кнопки "Попробовать снова"
 */

'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 mb-4">
            <AlertTriangle className="h-6 w-6 text-danger" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Щось пішло не так</h3>
          <p className="text-sm text-foreground-muted mb-4 max-w-md">
            {this.state.error?.message || 'Неочікувана помилка'}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Спробувати знову
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Простой fallback для страниц
 */
export function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 mb-4">
        <AlertTriangle className="h-8 w-8 text-danger" />
      </div>
      <h2 className="text-xl font-bold mb-2">Помилка</h2>
      <p className="text-foreground-muted mb-6 max-w-md">
        {error.message || 'Сталася помилка під час завантаження'}
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Спробувати знову
        </Button>
        <Button onClick={() => window.location.reload()}>
          Перезавантажити
        </Button>
      </div>
    </div>
  );
}
