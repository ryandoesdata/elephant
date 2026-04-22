CREATE TABLE IF NOT EXISTS pieces (
  id             SERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  composer       TEXT NOT NULL,
  movement       TEXT,
  total_measures INT NOT NULL,
  segment_size   INT NOT NULL DEFAULT 4,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
