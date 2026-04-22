CREATE TABLE IF NOT EXISTS segments (
  id                SERIAL PRIMARY KEY,
  piece_id          INT NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  measure_start     INT NOT NULL,
  measure_end       INT NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  parent_segment_id INT REFERENCES segments(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT segments_measure_order CHECK (measure_start < measure_end)
);

CREATE INDEX IF NOT EXISTS idx_segments_piece_active
  ON segments(piece_id, is_active);
