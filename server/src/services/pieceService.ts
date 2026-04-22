import { pool } from '../db/client';

export async function createPiece(
  title: string,
  composer: string,
  totalMeasures?: number
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pieceResult = await client.query<{ id: number }>(
      `INSERT INTO pieces (title, composer, total_measures)
       VALUES ($1, $2, $3) RETURNING id`,
      [title, composer, totalMeasures ?? null]
    );
    const pieceId = pieceResult.rows[0].id;

    await client.query(
      `INSERT INTO piece_progress
         (piece_id, total_segments_initial, active_segments_count, mastered_segments_count)
       VALUES ($1, 0, 0, 0)`,
      [pieceId]
    );

    await client.query('COMMIT');
    return pieceId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function createMovement(
  pieceId: number,
  title: string,
  orderIndex: number = 0
): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `INSERT INTO movements (piece_id, title, order_index)
     VALUES ($1, $2, $3) RETURNING id`,
    [pieceId, title, orderIndex]
  );
  return result.rows[0].id;
}

export async function addPhrase(
  pieceId: number,
  movementId: number | null,
  measureStart: number,
  measureEnd: number
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const segResult = await client.query<{ id: number }>(
      `INSERT INTO segments (piece_id, movement_id, measure_start, measure_end)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [pieceId, movementId, measureStart, measureEnd]
    );
    const segmentId = segResult.rows[0].id;

    await client.query(
      `INSERT INTO review_cards (segment_id, piece_id, due_at)
       VALUES ($1, $2, NOW())`,
      [segmentId, pieceId]
    );

    // Keep piece_progress totals in sync
    await client.query(
      `UPDATE piece_progress
       SET total_segments_initial = total_segments_initial + 1,
           active_segments_count  = active_segments_count  + 1,
           updated_at             = NOW()
       WHERE piece_id = $1`,
      [pieceId]
    );

    await client.query('COMMIT');
    return segmentId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPieceWithProgress(pieceId: number) {
  const pieceResult = await pool.query(
    `SELECT p.id, p.title, p.composer, p.total_measures,
            pp.total_segments_initial, pp.active_segments_count,
            pp.mastered_segments_count, pp.is_complete
     FROM pieces p
     JOIN piece_progress pp ON pp.piece_id = p.id
     WHERE p.id = $1`,
    [pieceId]
  );
  if (pieceResult.rows.length === 0) return null;
  const piece = pieceResult.rows[0];

  const movementsResult = await pool.query(
    `SELECT id, title, order_index, is_complete
     FROM movements WHERE piece_id = $1
     ORDER BY order_index, id`,
    [pieceId]
  );

  return { ...piece, movements: movementsResult.rows };
}

// Reassign all piece-level segments (movement_id IS NULL) to a specific movement.
// Called when the user adds their first movement and needs to categorise existing phrases.
export async function assignUnassignedSegments(
  pieceId: number,
  movementId: number
): Promise<number> {
  const result = await pool.query(
    `UPDATE segments
     SET movement_id = $1
     WHERE piece_id = $2 AND movement_id IS NULL`,
    [movementId, pieceId]
  );
  return result.rowCount ?? 0;
}

export async function deletePiece(pieceId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // review_log and review_cards have no cascade, delete manually first
    await client.query(`DELETE FROM review_log WHERE piece_id = $1`, [pieceId]);
    await client.query(`DELETE FROM review_cards WHERE piece_id = $1`, [pieceId]);
    // piece_progress, movements, segments all cascade from pieces
    await client.query(`DELETE FROM pieces WHERE id = $1`, [pieceId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteMovement(pieceId: number, movementId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Get segment IDs belonging to this movement
    const segResult = await client.query<{ id: number }>(
      `SELECT id FROM segments WHERE movement_id = $1`,
      [movementId]
    );
    const segIds = segResult.rows.map((r) => r.id);

    if (segIds.length > 0) {
      // Count mastered cards before deleting
      const masteredResult = await client.query<{ count: string }>(
        `SELECT COUNT(*) FROM review_cards WHERE segment_id = ANY($1::int[]) AND is_mastered = TRUE AND is_active = TRUE`,
        [segIds]
      );
      const masteredCount = parseInt(masteredResult.rows[0].count, 10);
      const removedCount = segIds.length;

      await client.query(
        `DELETE FROM review_log WHERE segment_id = ANY($1::int[])`,
        [segIds]
      );
      await client.query(
        `DELETE FROM review_cards WHERE segment_id = ANY($1::int[])`,
        [segIds]
      );

      await client.query(
        `UPDATE piece_progress
         SET total_segments_initial  = GREATEST(0, total_segments_initial  - $1),
             active_segments_count   = GREATEST(0, active_segments_count   - $1),
             mastered_segments_count = GREATEST(0, mastered_segments_count - $2),
             updated_at              = NOW()
         WHERE piece_id = $3`,
        [removedCount, masteredCount, pieceId]
      );
    }

    // deleting movement cascades its segments
    await client.query(`DELETE FROM movements WHERE id = $1 AND piece_id = $2`, [movementId, pieceId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getAllPieces() {
  const result = await pool.query(
    `SELECT p.id, p.title, p.composer, p.total_measures,
            pp.total_segments_initial, pp.active_segments_count,
            pp.mastered_segments_count, pp.is_complete
     FROM pieces p
     JOIN piece_progress pp ON pp.piece_id = p.id
     ORDER BY p.composer, p.title, p.id`
  );
  return result.rows;
}
