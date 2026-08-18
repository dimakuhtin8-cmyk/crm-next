export const TELEGRAM_CONFIG = {
  botToken: process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '',
  botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '',
  isConfigured: !!(
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN && process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
  ),
};
