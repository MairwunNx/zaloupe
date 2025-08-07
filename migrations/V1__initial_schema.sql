CREATE TYPE chat_type_enum AS ENUM ('private','group','supergroup','channel');
CREATE TYPE event_type_enum AS ENUM ('index','search');
CREATE TABLE chats (
  chat_id     BIGINT PRIMARY KEY,
  chat_type   chat_type_enum NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);

CREATE TABLE users (
  user_id     BIGINT PRIMARY KEY,
  username    TEXT
);

CREATE TABLE user_chat_settings (
  user_id     BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
  chat_id     BIGINT REFERENCES chats(chat_id) ON DELETE CASCADE,
  allow_collect BOOLEAN DEFAULT TRUE,
  revoked_at  TIMESTAMPTZ,
  PRIMARY KEY (user_id, chat_id)
);

CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  event_type_enum NOT NULL,
  user_id     BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  chat_id     BIGINT REFERENCES chats(chat_id) ON DELETE CASCADE,
  message_id  BIGINT,
  latency_ms  INT,
  ts          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_chat_ts ON events(chat_id, ts DESC);
CREATE INDEX idx_events_user_ts ON events(user_id, ts DESC);
CREATE INDEX idx_events_type_ts ON events(event_type, ts DESC);