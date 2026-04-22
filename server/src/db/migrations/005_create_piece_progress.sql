CREATE TABLE IF NOT EXISTS piece_progress (
  piece_id                INT PRIMARY KEY REFERENCES pieces(id) ON DELETE CASCADE,
  total_segments_initial  INT NOT NULL,
  active_segments_count   INT NOT NULL,
  mastered_segments_count INT NOT NULL DEFAULT 0,
  is_complete             BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
