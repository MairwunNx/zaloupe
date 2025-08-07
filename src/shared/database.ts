import { sql } from "bun";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { AppError, toError } from "./error";

export type DB = typeof sql;
export interface DbEnv { readonly db: DB }
export type DBTask<A> = RTE.ReaderTaskEither<DbEnv, AppError, A>;

const tryDb = <A>(f: (db: DB) => Promise<A>): DBTask<A> =>
  ({ db }) => TE.tryCatch(() => f(db), toError);
  
export const query = <Row>(
  strings: TemplateStringsArray,
  ...vals: unknown[]
): DBTask<Row[]> =>
  tryDb(db => db<Row[]>(strings, ...vals));

export const one = <Row>(
  strings: TemplateStringsArray,
  ...vals: unknown[]
): DBTask<Row | undefined> =>
  pipe(query<Row>(strings, ...vals), RTE.map(rows => rows[0]));
  
export const exec = (
  strings: TemplateStringsArray,
  ...vals: unknown[]
): DBTask<void> => pipe(query(strings, ...vals), RTE.map(() => void 0));

export const withTransaction = <A>(task: DBTask<A>): DBTask<A> =>
  tryDb(db =>
    db.begin(async trx => {
      const res = await task({ db: trx })();
      if (res._tag === "Left") throw res.left;
      return res.right;
    })
  );

export type ChatType = "private" | "group" | "supergroup" | "channel";

export interface Chat {
  chat_id: bigint;
  chat_type: ChatType;
  accepted_at?: Date;
  revoked_at?: Date;
}

export interface User {
  user_id: bigint;
  username?: string;
}

export type EventType = "index" | "search" ;

export interface EventBase {
  id: string;
  event_type: EventType;
  chat_id: bigint;
  user_id?: bigint | null;
}

export const ChatRepo = {
  get: (id: bigint): DBTask<Chat | undefined> =>
    one<Chat>`SELECT * FROM chats WHERE chat_id = ${id}`,

  upsert: (c: Chat): DBTask<void> => exec`
    INSERT INTO chats (chat_id, chat_type, accepted_at, revoked_at)
    VALUES (${c.chat_id}, ${c.chat_type}, ${c.accepted_at ?? null}, ${c.revoked_at ?? null})
    ON CONFLICT (chat_id)
    DO UPDATE SET chat_type  = EXCLUDED.chat_type,
                 accepted_at = EXCLUDED.accepted_at,
                 revoked_at  = EXCLUDED.revoked_at`,

  accept: (id: bigint): DBTask<void> =>
    exec`UPDATE chats SET accepted_at = NOW(), revoked_at = NULL WHERE chat_id = ${id}`,

  revoke: (id: bigint): DBTask<void> =>
    exec`UPDATE chats SET revoked_at = NOW() WHERE chat_id = ${id}`
};

export const UserRepo = {
  get: (id: bigint): DBTask<User | undefined> =>
    one<User>`SELECT * FROM users WHERE user_id = ${id}`,

  upsert: (u: User): DBTask<void> => exec`
    INSERT INTO users (user_id, username)
    VALUES (${u.user_id}, ${u.username ?? null})
    ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username`
};

export const EventRepo = {
  insert: (e: EventBase): DBTask<void> => exec`
    INSERT INTO events (id, event_type, chat_id, user_id)
    VALUES (${e.id}, ${e.event_type}, ${e.chat_id}, ${e.user_id ?? null})`
};