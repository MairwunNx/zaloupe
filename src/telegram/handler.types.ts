import { Context } from 'grammy';

export type Handler = (ctx: Context) => Promise<void>;
