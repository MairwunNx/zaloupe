import { Bot } from 'grammy';
import { BOT_TOKEN, DATABASE_URL } from './entrypoint.env';
import { logError, logInfo, logSuccess } from '../shared/logging';
import { onStart, onNotation, onStats, onChatMemberUpdate, onCallback, onMessage, onSearch, onSearchCallback } from '../telegram/handler';

async function main() {
  if (!BOT_TOKEN) return logError("BOT_TOKEN не задан в .env");
  if (!DATABASE_URL) return logError("DATABASE_URL не задан в .env");

  const bot = new Bot(BOT_TOKEN);

  bot.command("start", onStart);
  bot.command("notation", onNotation);
  bot.command("stats", onStats);
  bot.command("search", onSearch);

  bot.on("my_chat_member", onChatMemberUpdate);
  bot.on("callback_query:data", async (ctx, next) => {
    const data = ctx.callbackQuery?.data ?? "";
    if (data.startsWith("show:")) return onSearchCallback(ctx);
    return onCallback(ctx);
  });
  bot.on("message", onMessage);

  bot.catch((err) => {
    const errorMessage = err.error instanceof Error ? err.error.message : String(err.error);
    logError(`Ошибка в цикле обработки сообщений телеграм: ${errorMessage}`);
  });

  ["SIGINT", "SIGTERM"].forEach((sig) =>
    process.once(sig, () => {
      logInfo(`Получен ${sig}, останавливаю бота…`);
      bot.stop();
    })
  );

  await bot.start();
  logSuccess("Zaloupe бот запущен");
}

main().catch((err) => {
  logError(`Критическая ошибка: ${err.message}`);
  process.exit(1);
});