import { InlineKeyboard } from "grammy";
import {
  KB_ACCEPT,
  KB_REVOKE_CHAT,
  KB_REVOKE_PERSONAL,
  KB_PURGE_CHAT,
  KB_PURGE_ME,
  KB_DISABLED,
  KB_PG_BACK,
  KB_PG_NEXT,
  MSG_PAGINATION_LABEL,
} from "./messages";

export const C = {
  ACCEPT: "accept_terms",
  REVOKE_CHAT: "revoke_chat",
  REVOKE_PERSONAL: "revoke_personal",
  PURGE_CHAT: "purge_chat",
  PURGE_ME: "purge_me",
} as const;

export const kbAccept = new InlineKeyboard().text(KB_ACCEPT, C.ACCEPT);
export const kbPurgeAll = new InlineKeyboard().text(KB_PURGE_CHAT, C.PURGE_CHAT);
export const kbPurgeMe = new InlineKeyboard().text(KB_PURGE_ME, C.PURGE_ME);

export const kbNotation = (priv: boolean) =>
  new InlineKeyboard()
    .text(KB_REVOKE_CHAT, C.REVOKE_CHAT)
    .row()
    .text(priv ? KB_DISABLED : KB_REVOKE_PERSONAL, C.REVOKE_PERSONAL);

export const kbPagination = (token: string, page: number, pageSize: number, pages: number) =>
  new InlineKeyboard()
    .text(KB_PG_BACK, `pg:${token}:${pageSize}:${page - 1}`)
    .text(MSG_PAGINATION_LABEL(page, pages), "noop")
    .text(KB_PG_NEXT, `pg:${token}:${pageSize}:${page + 1}`);
