'use client';

import { useEffect, useRef } from 'react';

interface TelegramLoginWidgetProps {
  botUsername: string;
  onAuth: (data: TelegramAuthData) => void;
  onErrors?: (error: string) => void;
}

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    Telegram?: {
      Login?: {
        auth: (options: {
          bot_id: string;
          request_access: string;
          size: string;
          corner_radius: number;
          on_auth: (user: TelegramAuthData) => void;
        }) => void;
      };
    };
  }
}

export function TelegramLoginWidget({ botUsername, onAuth, onErrors }: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !botUsername) return;

    // Load Telegram Login Widget script
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'true');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.async = true;

    // Define global callback
    (window as unknown as Record<string, (user: TelegramAuthData) => void>).onTelegramAuth = (user: TelegramAuthData) => {
      onAuth(user);
    };

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [botUsername, onAuth, onErrors]);

  return (
    <div className="flex justify-center">
      <div ref={containerRef} />
    </div>
  );
}
