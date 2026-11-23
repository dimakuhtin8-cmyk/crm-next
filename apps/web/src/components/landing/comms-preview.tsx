'use client';

/**
 * «Комунікація»: split-view всіх каналів CRM — лише Telegram, WhatsApp і Email
 * (телефонії немає). Подія циклу: нове повідомлення прилітає — бейдж росте,
 * сніпет оновлюється, бульбашка дописується в листування.
 */

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export function CommsPreview() {
  const t = useTranslations('landing.comms');
  const [paused, setPaused] = useState(false);
  const [arrival, setArrival] = useState(0);

  const INBOX = [
    {
      name: 'Telegram',
      time: '10:42',
      unread: 2,
      tone: 'bg-info-light text-info',
    },
    {
      name: 'WhatsApp',
      snippet: t('waSnippet'),
      time: '09:58',
      unread: 1,
      tone: 'bg-success-light text-success',
    },
    {
      name: 'Email',
      snippet: t('emailSnippet'),
      time: t('yesterday'),
      unread: 0,
      tone: 'bg-primary-light text-primary',
    },
  ];

  const TELEGRAM_SNIPPETS = [
    t('msg.quoteRequest'),
    t('msg.quoteReceived'),
    t('msg.waitingInvoice'),
  ];

  const INCOMING = [t('msg.quoteReceived'), t('msg.waitingInvoice'), t('msg.sendInvoice')];

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setArrival((a) => a + 1), 4900);
    return () => clearInterval(timer);
  }, [paused]);

  const telegramUnread = 2 + (arrival % 3);
  const telegramSnippet = TELEGRAM_SNIPPETS[arrival % TELEGRAM_SNIPPETS.length];
  const incoming = arrival > 0 ? INCOMING[(arrival - 1) % INCOMING.length] : null;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-sm font-bold">{t('title')}</p>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground-secondary">
          {t('channelsBadge')}
        </span>
      </div>

      <div className="grid sm:grid-cols-2">
        {/* Список каналів */}
        <ul className="divide-y divide-border border-b border-border sm:border-b-0 sm:border-r">
          {INBOX.map((item) => {
            const isTelegram = item.name === 'Telegram';
            const unread = isTelegram ? telegramUnread : item.unread;
            const snippet = isTelegram ? telegramSnippet : item.snippet;
            return (
              <li
                key={item.name}
                className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-secondary"
              >
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.tone}`}
                >
                  {item.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <span className="shrink-0 text-[11px] text-foreground-muted">{item.time}</span>
                  </div>
                  <motion.p
                    key={snippet}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="truncate text-xs text-foreground-secondary"
                  >
                    {snippet}
                  </motion.p>
                </div>
                {unread > 0 && (
                  <motion.span
                    className="mt-1 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground"
                    animate={paused ? { scale: 1 } : { scale: [1, 1.18, 1] }}
                    transition={{
                      duration: 0.7,
                      repeat: Infinity,
                      repeatDelay: 4.2,
                      ease: 'easeOut',
                    }}
                  >
                    {unread}
                  </motion.span>
                )}
              </li>
            );
          })}
        </ul>

        {/* Листування */}
        <div className="flex flex-col gap-2.5 px-4 py-3.5">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2 text-sm">
            {t('msg.quoteRequest')}
          </div>
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
            {t('bubbleReply')}
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2 text-sm">
            {t('bubbleThanks')}
          </div>
          {incoming && (
            <motion.div
              key={arrival}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2 text-sm"
            >
              {incoming}
            </motion.div>
          )}
          <div className="mt-auto flex items-center gap-2 rounded-lg border border-border bg-background-secondary px-3 py-2 text-xs text-foreground-muted">
            {t('placeholder')}
            <span
              className="ml-auto inline-block h-3.5 w-0.5 animate-pulse bg-primary"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
