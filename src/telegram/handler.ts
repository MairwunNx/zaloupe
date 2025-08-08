
import { Context, InlineKeyboard } from "grammy";

import { ChatRepo, UserRepo, StatsRepo, EventRepo } from "../shared/database";
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
  MSG_STATS,
  MSG_SEARCH_HEADER,
  MSG_SEARCH_NO_RESULTS,
  MSG_SEARCH_USAGE,
  MSG_SHOW_FULL_BUTTON,
} from "./messages";
import { logError } from "../shared/logging";
import { indexMessage, searchMessages, ensureIndex } from "../features/search/search.service";

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

export async function onMessage(ctx: Context) {
  const msg = ctx.message;
  const chat = ctx.chat;
  if (!msg || !chat) return;
  if (!("text" in msg) || typeof msg.text !== "string") return;
  if (msg.text.startsWith("/") || (Array.isArray((msg as any).entities) && (msg as any).entities.some((e: any) => e.type === "bot_command" && e.offset === 0))) {
    return;
  }
  try {
    const chatId = BigInt(chat.id);
    const chatRow = await ChatRepo.get(chatId);
    if (!chatRow?.accepted_at || chatRow.revoked_at) return;
    const messageId = msg.message_id;
    await ensureIndex();
    await indexMessage({
      chat_id: String(chat.id),
      message_id: messageId,
      from_id: msg.from ? String(msg.from.id) : undefined,
      date: new Date((msg.date ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      text: msg.text,
      entities: (msg.entities as any) ?? undefined,
      chat_type: chat.type,
    });
    await EventRepo.insert({ id: crypto.randomUUID(), event_type: "index", chat_id: chatId, user_id: msg.from ? BigInt(msg.from.id) : null, message_id: BigInt(messageId) });
  } catch (e) {
    logError((e as Error).message);
  }
}

function makeSnippet(text: string, query: string): string {
  const q = query.trim();
  if (!text) return "";
  if (!q) return text.slice(0, 160);
  const lower = text.toLowerCase();
  const term = q.split(/\s+/)[0].toLowerCase();
  const idx = lower.indexOf(term);
  if (idx === -1) return text.slice(0, 160);
  const start = Math.max(0, idx - 120);
  const end = Math.min(text.length, idx + term.length + 120);
  const leftDots = start > 0 ? "…" : "";
  const rightDots = end < text.length ? "…" : "";
  let snippet = text.slice(start, end).trim();
  return `${leftDots}${snippet}${rightDots}`;
}

export async function onSearch(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const raw = (ctx.message && "text" in ctx.message && typeof ctx.message.text === "string") ? ctx.message.text : "";
  const query = raw.replace(/^\/search(?:@\w+)?\s*/i, "").trim();
  if (!query) {
    await ctx.reply(MSG_SEARCH_USAGE);
    return;
  }
  const res = await searchMessages({ chatId: BigInt(chatId), query, limit: 5 });
  try {
    await EventRepo.insert({ id: crypto.randomUUID(), event_type: "search", chat_id: BigInt(chatId), user_id: ctx.from ? BigInt(ctx.from.id) : null });
  } catch {}

  if (!res.total) {
    await ctx.reply(MSG_SEARCH_NO_RESULTS(query));
    return;
  }

  await ctx.reply(MSG_SEARCH_HEADER(query, res.total));

  for (const hit of res.hits) {
    const full = hit.doc.text ?? "";
    const snippet = makeSnippet(full, query);
    const [chat_id, message_id_str] = hit.id.split(":");
    const kb = new InlineKeyboard().text(MSG_SHOW_FULL_BUTTON, `show:${chat_id}:${message_id_str}`);
    await ctx.reply(snippet || full.slice(0, 200), { reply_markup: kb });
  }
}

export async function onSearchCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data ?? "";
  const m = /^show:(-?\d+):(\d+)$/.exec(data);
  if (!m) return;
  const [, chatIdStr, msgIdStr] = m;
  try {
    if (!ctx.chat?.id) return;
    await ctx.api.copyMessage(Number(ctx.chat.id), Number(chatIdStr), Number(msgIdStr));
  } catch (e) {
    logError((e as Error).message);
  } finally {
    await ctx.answerCallbackQuery();
  }
}
