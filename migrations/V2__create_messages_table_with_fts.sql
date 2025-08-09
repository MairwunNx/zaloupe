CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE messages (
    chat_id         BIGINT NOT NULL,
    message_id      BIGINT NOT NULL,
    from_id         BIGINT,
    from_username   TEXT,
    date            TIMESTAMPTZ NOT NULL,
    text            TEXT,
    chat_type       chat_type_enum,
    PRIMARY KEY (chat_id, message_id)
);

ALTER TABLE messages ADD COLUMN tsv tsvector;

CREATE OR REPLACE FUNCTION messages_tsvector_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv := setweight(to_tsvector('russian', coalesce(unaccent(NEW.text), '')), 'A');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update_trigger BEFORE INSERT OR UPDATE
ON messages FOR EACH ROW EXECUTE FUNCTION messages_tsvector_update();

CREATE INDEX IF NOT EXISTS idx_messages_tsv ON messages USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_messages_trgm ON messages USING GIN (text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_messages_chat_date ON messages(chat_id, date DESC);
