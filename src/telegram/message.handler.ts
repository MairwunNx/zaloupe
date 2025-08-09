import { Context } from "grammy";
import { ChatRepo, EventRepo } from "../shared/database";
import { logError, logInfo } from "../shared/logging";
import { enqueueIndex } from "../queue/index.queue";

export async function onMessage(ctx: Context) {
  const msg = ctx.message;
  const chat = ctx.chat;
  if (!msg || !chat) return;
  if (!("text" in msg) || typeof msg.text !== "string") return;
  if (
    msg.text.startsWith("/") ||
    (Array.isArray((msg as any).entities) &&
      (msg as any).entities.some((e: any) => e.type === "bot_command" && e.offset === 0))
  ) {
    return;
  }
  
  try {
    const chatId = BigInt(chat.id);
    const chatRow = await ChatRepo.get(chatId);
    if (!chatRow?.accepted_at || chatRow.revoked_at) {
      logInfo(`Сообщение в чате ${chat.id} игнорируется - чат не принят или отозван`);
      return;
    }
    
    const messageId = msg.message_id;
    const trimmed = msg.text.trim();
    
    logInfo(`Обрабатываю сообщение ${chat.id}:${messageId} от ${msg.from?.username || 'анонима'}`);
    
    await enqueueIndex({
      chat_id: chat.id,
      message_id: messageId,
      from_id: msg.from?.id,
      from_username: msg.from?.username,
      date: new Date(msg.date * 1000),
      text: msg.text,
      chat_type: chat.type,
    });

    await EventRepo.insert({
      id: crypto.randomUUID(),
      event_type: "index",
      chat_id: chatId,
      user_id: msg.from ? BigInt(msg.from.id) : null,
      message_id: BigInt(messageId),
    });
    
    logInfo(`Сообщение ${chat.id}:${messageId} успешно обработано`);
  } catch (e) {
    logError(`Ошибка обработки сообщения в чате ${chat.id}: ${(e as Error).message}`);
  }
}
