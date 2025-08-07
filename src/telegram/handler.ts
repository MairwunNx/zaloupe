
import { Context, InlineKeyboard } from "grammy";

import {
  ChatRepo,
  UserRepo,
  StatsRepo
} from "../shared/database";
import {
  MSG_START_GROUP,
  MSG_START_PRIVATE,
  MSG_ACCEPTED_GROUP,
  MSG_ACCEPTED_PRIVATE,
  MSG_REJECTED,
  MSG_NOTATION,
  MSG_REVOKE_CHAT_OK,
  MSG_REVOKE_ME_OK,
  MSG_PURGE_QUEUED,
  MSG_STATS
} from "./messages";
import { logError } from "../shared/logging";

const C = {
  ACCEPT: "accept_terms",
  REVOKE_CHAT: "revoke_chat",
  REVOKE_PERSONAL: "revoke_personal",
  PURGE_CHAT: "purge_chat",
  PURGE_ME: "purge_me"
} as const;

const kbAccept = new InlineKeyboard().text("Принять условия", C.ACCEPT);
const kbPurgeAll = new InlineKeyboard().text("Удалить все сообщения группы", C.PURGE_CHAT);
const kbPurgeMe = new InlineKeyboard().text("Удалить мои сообщения", C.PURGE_ME);
const kbNotation = (priv: boolean) =>
  new InlineKeyboard()
    .text("Расторгнуть соглашение", C.REVOKE_CHAT)
    .row()
    .text(priv ? "—" : "Расторгнуть персональное", C.REVOKE_PERSONAL);

async function isAdmin(ctx: Context, uid: number): Promise<boolean> {
  if (ctx.chat?.type === "private") return true;
  try {
    const m = await ctx.getChatMember(uid);
    return ["administrator", "creator"].includes(m.status);
  } catch {
    return false;
  }
}

export async function onNotation(ctx: Context) {
  await ctx.reply(MSG_NOTATION, { reply_markup: kbNotation(ctx.chat?.type === "private") });
}

export async function onStart(ctx: Context) {
  try {
    const chat = ctx.chat;
    if (!chat) return;

    await ChatRepo.upsert({ chat_id: BigInt(chat.id), chat_type: chat.type as any });
    const row = await ChatRepo.get(BigInt(chat.id));

    if (row?.accepted_at) {
      await onNotation(ctx);
    } else {
      await ctx.reply(
        chat.type === "private" ? MSG_START_PRIVATE : MSG_START_GROUP,
        { reply_markup: kbAccept }
      );
    }
  } catch (e) {
    logError((e as Error).message);
  }
}

export const onChatMemberUpdate = onStart;

export async function onCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  const chat = ctx.chat;
  const user = ctx.from;
  if (!data || !chat || !user) return;

  const chatId = BigInt(chat.id);
  const userId = user.id;

  try {
    const chatRow = await ChatRepo.get(chatId);
    switch (data) {
      case C.ACCEPT: {
        if (chatRow?.accepted_at) break;
        const admin = await isAdmin(ctx, userId);
        if (!admin) {
          await ctx.answerCallbackQuery({ text: MSG_REJECTED, show_alert: true });
          break;
        }
        await ChatRepo.accept(chatId);
        await UserRepo.upsert({ user_id: BigInt(userId), username: user.username });
        await ctx.reply(chat.type === "private" ? MSG_ACCEPTED_PRIVATE : MSG_ACCEPTED_GROUP);
        break;
      }

      case C.REVOKE_CHAT: {
        const admin = await isAdmin(ctx, userId);
        if (!admin) {
          await ctx.answerCallbackQuery({ text: MSG_REJECTED, show_alert: true });
          break;
        }
        await ChatRepo.revoke(chatId);
        await ctx.reply(MSG_REVOKE_CHAT_OK, { reply_markup: kbPurgeAll });
        break;
      }

      case C.REVOKE_PERSONAL: {
        if (chat.type === "private") break;
        await ctx.reply(MSG_REVOKE_ME_OK, { reply_markup: kbPurgeMe });
        break;
      }

      case C.PURGE_CHAT:
      case C.PURGE_ME:
        await ctx.reply(MSG_PURGE_QUEUED);
        break;
    }
  } catch (e) {
    logError((e as Error).message);
  } finally {
    await ctx.answerCallbackQuery();
  }
}

export async function onStats(ctx: Context) {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return;

  try {
    const { global, chat, user } = await StatsRepo.getStats(BigInt(chatId), BigInt(userId), true);

    await ctx.reply(
      MSG_STATS(
        global.messages,
        global.searches,
        chat.messages,
        chat.searches,
        user.messages,
        user.searches
      ),
      { parse_mode: "Markdown" }
    );
  } catch (e) {
    logError((e as Error).message);
    await ctx.reply("❌ Ошибка при получении статистики");
  }
}
