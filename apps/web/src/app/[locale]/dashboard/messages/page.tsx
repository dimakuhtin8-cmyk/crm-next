'use client';

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui';
import { MessageSquare } from 'lucide-react';

export default function MessagesPage() {
  // Mark messages as read when visiting the page
  useEffect(() => {
    fetch('/api/messages/read', { method: 'POST' }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Повідомлення</h1>
          <p className="text-foreground-muted">Спілкування з клієнтами</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Повідомлень поки немає</h3>
          <p className="text-sm text-foreground-muted max-w-sm">
            Тут з&apos;являться ваші розмови з клієнтами через Telegram, WhatsApp та Email після підключення месенджерів.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
