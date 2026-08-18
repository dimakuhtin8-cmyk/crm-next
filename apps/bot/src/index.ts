import { Bot } from 'grammy';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log('⚠️  TELEGRAM_BOT_TOKEN not set — bot will not start');
  console.log('   Set it in .env to enable Telegram bot');
  process.exit(0);
}

const bot = new Bot(token);

bot.command('start', (ctx) => {
  return ctx.reply('🚀 CRM-Next Bot is running!\n\nUse /help to see available commands.');
});

bot.command('help', (ctx) => {
  return ctx.reply(
    '📋 Available commands:\n\n/start - Start the bot\n/help - Show this message\n/status - Check bot status'
  );
});

bot.command('status', (ctx) => {
  return ctx.reply('✅ Bot is operational\n🕐 ' + new Date().toISOString());
});

async function start() {
  console.log('🤖 Starting Telegram bot...');
  await bot.start();
  console.log('✅ Telegram bot is running!');
}

start().catch(console.error);
