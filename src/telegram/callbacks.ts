import { Context } from "grammy";
import { ChatRepo, UserRepo } from "../shared/database";
import { logError } from "../shared/logging";
import {
  MSG_ACCEPTED_GROUP,
  MSG_ACCEPTED_PRIVATE,
  MSG_REJECTED,
  MSG_REVOKE_CHAT_OK,
  MSG_REVOKE_ME_OK,
  MSG_PURGE_QUEUED,
  MSG_SEARCH_HEADER,
} from "./messages";
import { kbPurgeAll, kbPurgeMe, kbPagination, C } from "./keyboards";
import { readSearchToken } from "../shared/tokens";
import { searchMessages } from "../features/search/search.service";
import { escapeMd, formatDateDMY } from "../shared/utils";

async function isAdmin(ctx: Context, uid: number): Promise<boolean> {
  if (ctx.chat?.type === "private") return true;
  try {
    const m = await ctx.getChatMember(uid);
    return ["administrator", "creator"].includes(m.status);
  } catch {
    return false;
  }
}

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

export async function onSearchCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data ?? "";
  const m = /^pg:([A-Za-z0-9_-]{8,20}):(\d+):(\d+)$/.exec(data);
  if (m) {
    const [, token, sizeStr, pageStr] = m;
    const pageSize = Number(sizeStr);
    const page = Math.max(1, Number(pageStr));
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const totalMatch = /—\s(\d+)/.exec(ctx.callbackQuery?.message?.text ?? "");
    const total = Number(totalMatch?.[1] ?? 0);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const realPage = Math.min(Math.max(1, page), pages);
    const offset = (realPage - 1) * pageSize;
    const payload = await readSearchToken(token);
    const query = payload?.query ?? "";
    const res = await searchMessages({ chatId: BigInt(chatId), query, limit: pageSize, offset });

    const rawHeader = MSG_SEARCH_HEADER(query, total);
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
    const text = composed.slice(0, 3500);

    const kb = kbPagination(token, realPage, pageSize, pages);

    try {
      await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "MarkdownV2" });
    } catch (e) {
      logError((e as Error).message);
    } finally {
      await ctx.answerCallbackQuery();
    }
  }
}

