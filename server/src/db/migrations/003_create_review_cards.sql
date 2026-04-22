CREATE TABLE IF NOT EXISTS review_cards (
  id               SERIAL PRIMARY KEY,
  segment_id       INT NOT NULL REFERENCES segments(id),
  piece_id         INT NOT NULL REFERENCES pieces(id),
  easiness_factor  FLOAT NOT NULL DEFAULT 2.5,
  interval_days    FLOAT NOT NULL DEFAULT 0,
  repetitions      INT NOT NULL DEFAULT 0,
  due_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  is_mastered      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_cards_due
  ON review_cards(piece_id, is_active, due_at);

CREATE INDEX IF NOT EXISTS idx_review_cards_segment
  ON review_cards(segment_id);
