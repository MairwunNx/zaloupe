import { Context } from 'grammy';

export type Handler = (ctx: Context) => Promise<void>;

export type SearchHandler = (ctx: Context & { match: string }) => Promise<void>;
