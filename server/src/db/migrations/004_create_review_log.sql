CREATE TABLE IF NOT EXISTS review_log (
  id                     SERIAL PRIMARY KEY,
  card_id                INT NOT NULL REFERENCES review_cards(id),
  segment_id             INT NOT NULL REFERENCES segments(id),
  piece_id               INT NOT NULL REFERENCES pieces(id),
  rating                 SMALLINT NOT NULL CHECK (rating BETWEEN 0 AND 3),
  easiness_factor_before FLOAT,
  interval_before        FLOAT,
  interval_after         FLOAT,
  reviewed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_log_piece
  ON review_log(piece_id, reviewed_at DESC);
