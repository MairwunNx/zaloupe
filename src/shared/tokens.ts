import crypto from "node:crypto";
import { getRedis } from "../queue/redis";

const redis = getRedis();
const PREFIX = "search:q:";

export interface SearchTokenData {
  query: string;
  chatId: string;
}

function generateToken(): string {
  return crypto.randomBytes(9).toString("base64url"); // ~12 chars, safe for callback_data
}

export async function createSearchToken(chatId: string | number | bigint, query: string, ttlSec = 900): Promise<string> {
  const token = generateToken();
  const data: SearchTokenData = { query, chatId: String(chatId) };
  await redis.setex(PREFIX + token, ttlSec, JSON.stringify(data));
  return token;
}

export async function readSearchToken(token: string): Promise<SearchTokenData | null> {
  const raw = await redis.get(PREFIX + token);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SearchTokenData;
  } catch {
    return null;
  }
}
