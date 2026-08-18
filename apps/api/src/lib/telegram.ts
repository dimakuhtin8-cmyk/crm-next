export const TELEGRAM_CONFIG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
  loginWidgetUrl: 'https://telegram.org/js/telegram-widget.js?22',
  isConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME),
};

export function getTelegramLoginUrl(botUsername: string, redirectUrl: string): string {
  return `https://oauth.telegram.org/auth?bot_id=${botUsername}&origin=${encodeURIComponent(redirectUrl)}&request_access=write`;
}
