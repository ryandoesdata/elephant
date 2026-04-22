import { pool } from '../db/client';

export interface SplitEvent {
  occurred: boolean;
  splitSegment?: {
    segmentId: number;
    label: string;
  };
  restoredSegments?: Array<{
    segmentId: number;
    measureStart: number;
    measureEnd: number;
    label: string;
  }>;
}

// Number of distinct calendar days with a struggle rating (Again or Hard)
// before a merged segment is automatically split back into its sub-phrases.
const SPLIT_STRUGGLE_DAYS_THRESHOLD = 3;

export async function shouldSplit(cardId: number): Promise<boolean> {
  const result = await pool.query<{ days: string }>(
    `SELECT COUNT(DISTINCT DATE(reviewed_at)) AS days
     FROM review_log
     WHERE card_id = $1 AND rating <= 1`,
    [cardId]
  );
  return parseInt(result.rows[0].days, 10) >= SPLIT_STRUGGLE_DAYS_THRESHOLD;
}

export async function splitSegment(segmentId: number, pieceId: number): Promise<SplitEvent> {
  const client = await pool.connect();
  try {
    // Find the two direct children produced by the original merge
    const childrenResult = await client.query<{
      id: number; measure_start: number; measure_end: number;
    }>(
      `SELECT id, measure_start, measure_end
       FROM segments
       WHERE parent_segment_id = $1
       ORDER BY measure_start ASC`,
      [segmentId]
    );

    // Only handle the simple two-segment merge case
    if (childrenResult.rows.length !== 2) return { occurred: false };

    const [leftChild, rightChild] = childrenResult.rows;

    await client.query('BEGIN');

    // Deactivate the merged segment and its card
    await client.query(
      `UPDATE segments SET is_active = FALSE WHERE id = $1`,
      [segmentId]
    );
    await client.query(
      `UPDATE review_cards SET is_active = FALSE WHERE segment_id = $1`,
      [segmentId]
    );

    // Restore each child segment and its review card
    for (const child of [leftChild, rightChild]) {
      await client.query(
        `UPDATE segments SET is_active = TRUE WHERE id = $1`,
        [child.id]
      );

      const cardResult = await client.query<{ id: number; easiness_factor: number }>(
        `SELECT id, easiness_factor FROM review_cards
         WHERE segment_id = $1 AND is_active = FALSE
         ORDER BY id DESC LIMIT 1`,
        [child.id]
      );

      if (cardResult.rows.length === 0) {
        await client.query(
          `INSERT INTO review_cards
             (segment_id, piece_id, easiness_factor, interval_days, repetitions, due_at, is_mastered)
           VALUES ($1, $2, 2.5, 0, 0, NOW(), FALSE)`,
          [child.id, pieceId]
        );
      } else {
        const penalizedEF = Math.max(1.3, cardResult.rows[0].easiness_factor - 0.1);
        await client.query(
          `UPDATE review_cards
           SET is_active      = TRUE,
               repetitions    = 1,
               interval_days  = 1,
               easiness_factor = $1,
               due_at         = NOW(),
               is_mastered    = FALSE
           WHERE id = $2`,
          [penalizedEF, cardResult.rows[0].id]
        );
      }
    }

    // Net +1 active segment (removed 1 merged, restored 2 children)
    await client.query(
      `UPDATE piece_progress
       SET active_segments_count = active_segments_count + 1,
           updated_at = NOW()
       WHERE piece_id = $1`,
      [pieceId]
    );

    await client.query('COMMIT');

    return {
      occurred: true,
      splitSegment: {
        segmentId,
        label: formatLabel(leftChild.measure_start, rightChild.measure_end),
      },
      restoredSegments: [
        {
          segmentId: leftChild.id,
          measureStart: leftChild.measure_start,
          measureEnd: leftChild.measure_end,
          label: formatLabel(leftChild.measure_start, leftChild.measure_end),
        },
        {
          segmentId: rightChild.id,
          measureStart: rightChild.measure_start,
          measureEnd: rightChild.measure_end,
          label: formatLabel(rightChild.measure_start, rightChild.measure_end),
        },
      ],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export interface BreakEvent {
  occurred: boolean;
  originalSegment?: { segmentId: number; label: string };
  newSegments?: Array<{ segmentId: number; measureStart: number; measureEnd: number; label: string }>;
}

// midPoint is the internal measure_start of the right half (half-open interval).
// e.g. for "Measures 1–8" (stored as start=1, end=9), midPoint=5 yields
// "Measures 1–4" [1,5) and "Measures 5–8" [5,9).
export async function breakSegment(
  segmentId: number,
  pieceId: number,
  midPoint: number
): Promise<BreakEvent> {
  const client = await pool.connect();
  try {
    const segResult = await client.query<{
      id: number; measure_start: number; measure_end: number; movement_id: number | null;
    }>(
      `SELECT id, measure_start, measure_end, movement_id
       FROM segments
       WHERE id = $1 AND piece_id = $2 AND is_active = TRUE`,
      [segmentId, pieceId]
    );

    if (segResult.rows.length === 0) return { occurred: false };
    const seg = segResult.rows[0];

    if (midPoint <= seg.measure_start || midPoint >= seg.measure_end) {
      return { occurred: false };
    }

    await client.query('BEGIN');

    await client.query(`UPDATE segments SET is_active = FALSE WHERE id = $1`, [segmentId]);
    await client.query(`UPDATE review_cards SET is_active = FALSE WHERE segment_id = $1`, [segmentId]);

    const halves = [
      { measureStart: seg.measure_start, measureEnd: midPoint },
      { measureStart: midPoint, measureEnd: seg.measure_end },
    ];

    const newSegments: BreakEvent['newSegments'] = [];
    for (const half of halves) {
      const newSeg = await client.query<{ id: number }>(
        `INSERT INTO segments (piece_id, movement_id, measure_start, measure_end)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [pieceId, seg.movement_id, half.measureStart, half.measureEnd]
      );
      const newSegId = newSeg.rows[0].id;
      await client.query(
        `INSERT INTO review_cards
           (segment_id, piece_id, easiness_factor, interval_days, repetitions, due_at, is_mastered)
         VALUES ($1, $2, 2.5, 0, 0, NOW(), FALSE)`,
        [newSegId, pieceId]
      );
      newSegments.push({
        segmentId: newSegId,
        measureStart: half.measureStart,
        measureEnd: half.measureEnd,
        label: formatLabel(half.measureStart, half.measureEnd),
      });
    }

    // Net +1 active (removed 1, added 2)
    await client.query(
      `UPDATE piece_progress
       SET active_segments_count = active_segments_count + 1, updated_at = NOW()
       WHERE piece_id = $1`,
      [pieceId]
    );

    await client.query('COMMIT');

    return {
      occurred: true,
      originalSegment: { segmentId, label: formatLabel(seg.measure_start, seg.measure_end) },
      newSegments,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function formatLabel(start: number, end: number): string {
  return `Measures ${start}–${end}`;
}
