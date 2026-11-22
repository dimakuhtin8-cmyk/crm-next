// Только публичные данные бота. Токен бота НИКОГДА не должен попадать в
// клиентский код (NEXT_PUBLIC_* инлайнится в бандл) — он используется
// только на сервере (TELEGRAM_BOT_TOKEN).
export const TELEGRAM_CONFIG = {
  botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '',
  isConfigured: !!process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,
};
