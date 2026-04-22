-- Create movements table (each piece can have 0 or more movements)
-- A piece with no movements is its own deck; movements are separate decks
CREATE TABLE IF NOT EXISTS movements (
  id          SERIAL PRIMARY KEY,
  piece_id    INT NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_piece ON movements(piece_id);

-- Segments can now belong to a movement (or directly to a piece when movement_id IS NULL)
ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS movement_id INT REFERENCES movements(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_segments_movement
  ON segments(movement_id) WHERE movement_id IS NOT NULL;

-- total_measures is now optional (users define their own phrase ranges)
ALTER TABLE pieces ALTER COLUMN total_measures DROP NOT NULL;
ALTER TABLE pieces ALTER COLUMN total_measures SET DEFAULT NULL;

-- segment_size is no longer needed (users define their own segments)
ALTER TABLE pieces DROP COLUMN IF EXISTS segment_size;
