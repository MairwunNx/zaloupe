import { Context } from "grammy";
import { ChatRepo, EventRepo, StatsRepo } from "../shared/database";
import { logError } from "../shared/logging";
import {
  MSG_NOTATION,
  MSG_START_GROUP,
  MSG_START_PRIVATE,
  MSG_STATS,
  MSG_ERROR_STATS,
  MSG_SEARCH_USAGE,
  MSG_SEARCH_NO_RESULTS,
  MSG_SEARCH_HEADER,
} from "./messages";
import { kbAccept, kbNotation, kbPagination } from "./keyboards";
import { searchMessages } from "../features/search/search.service";
import { createSearchToken } from "../shared/tokens";
import { formatDateDMY, escapeMd } from "../shared/utils";

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
      await ctx.reply(chat.type === "private" ? MSG_START_PRIVATE : MSG_START_GROUP, {
        reply_markup: kbAccept,
      });
    }
  } catch (e) {
    logError((e as Error).message);
  }
}

export const onChatMemberUpdate = onStart;

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
    await ctx.reply(MSG_ERROR_STATS);
  }
}

export async function onSearch(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const raw =
    ctx.message && "text" in ctx.message && typeof ctx.message.text === "string"
      ? ctx.message.text
      : "";
  const query = raw.replace(/^\/search(?:@\w+)?\s*/i, "").trim();
  if (!query) {
    await ctx.reply(MSG_SEARCH_USAGE);
    return;
  }
  
  try {
    const pageSize = 12;
    const page = 1;
    const offset = 0;
    const res = await searchMessages({ chatId: BigInt(chatId), query, limit: pageSize, offset });
    
    try {
      await EventRepo.insert({
        id: crypto.randomUUID(),
        event_type: "search",
        chat_id: BigInt(chatId),
        user_id: ctx.from ? BigInt(ctx.from.id) : null,
      });
    } catch (e) {
      logError(`Ошибка сохранения события поиска: ${(e as Error).message}`);
    }

    if (!res.total) {
      await ctx.reply(MSG_SEARCH_NO_RESULTS(query));
      return;
    }
    const pages = Math.max(1, Math.ceil(res.total / pageSize));
    const token = await createSearchToken(chatId, query);

    const rawHeader = MSG_SEARCH_HEADER(query, res.total);
    const header = escapeMd(rawHeader);
    const blocks: string[] = [];
    for (const hit of res.hits) {
      const full = hit.doc.text ?? "";
      const username = hit.doc.from_username ? `@${hit.doc.from_username}` : "аноним";
      const when = formatDateDMY(hit.doc.date);
      const headerLine = `От ${username} ${when}.`;
      const ital = `_${escapeMd(headerLine)}_`;
      const body = `>${escapeMd(full)}||`;
      blocks.push(`${ital}\n${body}`);
    }
    let composed = `${header}\n\n${blocks.join("\n\n")}`;
    const text = composed.slice(0, 3900);

    const kb = kbPagination(token, page, pageSize, pages);

    await ctx.reply(text, { reply_markup: kb, parse_mode: "MarkdownV2" });
  } catch (e) {
    logError(`Ошибка поиска в чате ${chatId}: ${(e as Error).message}`);
    await ctx.reply("Произошла ошибка при поиске. Попробуйте позже.");
  }
}
