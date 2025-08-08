import Redis from "ioredis";

let singleton: Redis | null = null;

export function getRedis(): Redis {
  if (singleton) return singleton;
  const url = process.env.REDIS_URL || "redis://redis:6379";
  singleton = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  return singleton;
}
