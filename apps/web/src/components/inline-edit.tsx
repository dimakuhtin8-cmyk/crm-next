/**
 * InlineEdit — компонент для редактирования данных прямо на странице
 * 
 * Клик по полю → input → Enter/Blur → сохранение
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditProps {
  value: string | number | null;
  onSave: (value: string) => Promise<void>;
  type?: 'text' | 'email' | 'phone' | 'number' | 'textarea';
  label?: string;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
  emptyText?: string;
  disabled?: boolean;
}

export function InlineEdit({
  value,
  onSave,
  type = 'text',
  label,
  placeholder,
  className,
  displayClassName,
  emptyText = 'Не вказано',
  disabled = false,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value || ''));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue === String(value || '')) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch {} finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(String(value || ''));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn('group', className)}>
        {label && <p className="text-xs text-foreground-muted mb-1">{label}</p>}
        <div className="flex items-center gap-2">
          {type === 'textarea' ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-lg border border-primary bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              rows={3}
              placeholder={placeholder}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-lg border border-primary bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder={placeholder}
            />
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group cursor-pointer rounded-lg px-3 py-2 -mx-3 -my-2 hover:bg-secondary/50 transition-colors',
        disabled && 'cursor-default hover:bg-transparent',
        className,
      )}
      onClick={() => !disabled && setIsEditing(true)}
    >
      {label && <p className="text-xs text-foreground-muted mb-0.5">{label}</p>}
      <div className="flex items-center gap-2">
        <span className={cn('text-sm', !value && 'text-foreground-muted italic', displayClassName)}>
          {value ? String(value) : emptyText}
        </span>
        {!disabled && (
          <Pencil className="h-3 w-3 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );
}
