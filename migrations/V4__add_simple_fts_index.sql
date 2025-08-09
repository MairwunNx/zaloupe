CREATE INDEX IF NOT EXISTS idx_messages_tsv_simple
  ON messages USING GIN (to_tsvector('simple', text_unaccent));
