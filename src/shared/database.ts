import { sql } from "bun";

const db = sql;

export async function query<Row>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Row[]> {
  return db<Row[]>(strings, ...values);
}

export async function one<Row>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Row | undefined> {
  const rows = await query<Row>(strings, ...values);
  return rows[0];
}

export async function exec(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<void> {
  await query(strings, ...values);
}

export async function withTransaction<A>(fn: (trx: typeof db) => Promise<A>): Promise<A> {
  return db.begin(fn);
}

export type ChatType = "private" | "group" | "supergroup" | "channel";

export interface Chat {
  chat_id: bigint;
  chat_type: ChatType;
  accepted_at?: Date | null;
  revoked_at?: Date | null;
}

export interface User {
  user_id: bigint;
  username?: string | null;
}

export type EventType = "index" | "search";

export interface EventBase {
  id: string;
  event_type: EventType;
  chat_id: bigint;
  user_id?: bigint | null;
}

export const ChatRepo = {
  async get(id: bigint): Promise<Chat | undefined> {
    return one<Chat>`SELECT * FROM chats WHERE chat_id = ${id}`;
  },

  async upsert(c: Chat): Promise<void> {
    await exec`
      INSERT INTO chats (chat_id, chat_type, accepted_at, revoked_at)
      VALUES (${c.chat_id}, ${c.chat_type}, ${c.accepted_at ?? null}, ${c.revoked_at ?? null})
      ON CONFLICT (chat_id)
      DO UPDATE SET chat_type  = EXCLUDED.chat_type,
                   accepted_at = EXCLUDED.accepted_at,
                   revoked_at  = EXCLUDED.revoked_at`;
  },

  async accept(id: bigint): Promise<void> {
    await exec`UPDATE chats SET accepted_at = NOW(), revoked_at = NULL WHERE chat_id = ${id}`;
  },

  async revoke(id: bigint): Promise<void> {
    await exec`UPDATE chats SET revoked_at = NOW() WHERE chat_id = ${id}`;
  }
};

export const UserRepo = {
  async get(id: bigint): Promise<User | undefined> {
    return one<User>`SELECT * FROM users WHERE user_id = ${id}`;
  },

  async upsert(u: User): Promise<void> {
    await exec`
      INSERT INTO users (user_id, username)
      VALUES (${u.user_id}, ${u.username ?? null})
      ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username`;
  }
};

export const EventRepo = {
  async insert(e: EventBase): Promise<void> {
    await exec`
      INSERT INTO events (id, event_type, chat_id, user_id)
      VALUES (${e.id}, ${e.event_type}, ${e.chat_id}, ${e.user_id ?? null})`;
  }
};