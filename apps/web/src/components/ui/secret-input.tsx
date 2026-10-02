'use client';

import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';

import { Input } from './input';

type SecretInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Текст помилки під полем (валідація форми) */
  error?: string;
};

/**
 * Поле для секретів (API-ключі, паролі, токени) з кнопкою
 * показати/сховати значення (Eye / EyeOff).
 */
export function SecretInput({ className, error, ...props }: SecretInputProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          className={`pr-10 ${className ?? ''}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
          aria-label={visible ? 'Сховати значення' : 'Показати значення'}
          title={visible ? 'Сховати' : 'Показати'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
