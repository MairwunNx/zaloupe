CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS text_unaccent TEXT;

CREATE OR REPLACE FUNCTION messages_tsvector_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv := setweight(to_tsvector('russian', coalesce(unaccent(NEW.text), '')), 'A');
  NEW.text_unaccent := CASE
    WHEN NEW.text IS NULL THEN NULL
    ELSE unaccent(lower(NEW.text))
  END;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

UPDATE messages
SET text_unaccent = unaccent(lower(text))
WHERE text IS NOT NULL
  AND (text_unaccent IS DISTINCT FROM unaccent(lower(text)));

CREATE INDEX IF NOT EXISTS idx_messages_text_unaccent_trgm
  ON messages USING GIN (text_unaccent gin_trgm_ops);
