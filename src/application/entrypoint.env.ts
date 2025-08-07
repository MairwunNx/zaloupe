import dotenv from 'dotenv';

dotenv.config();

export const BOT_TOKEN = process.env.BOT_TOKEN ?? '';
export const DATABASE_URL = process.env.DATABASE_URL ?? '';
