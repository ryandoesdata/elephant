import { PoolClient } from 'pg';
import { pool } from '../db/client';
import { computeMergedCardState } from './sm2';

interface SegmentRow {
  id: number;
  piece_id: number;
  movement_id: number | null;
  measure_start: number;
  measure_end: number;
}

interface CardRow {
  id: number;
  segment_id: number;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  is_mastered: boolean;
}

export interface MergeEvent {
  occurred: boolean;
  newSegment?: {
    segmentId: number;
    measureStart: number;
    measureEnd: number;
    label: string;
  };
  absorbedSegments?: Array<{
    segmentId: number;
    label: string;
  }>;
}

export async function manualMerge(
  leftSegmentId: number,
  rightSegmentId: number,
  pieceId: number
): Promise<MergeEvent> {
  const client = await pool.connect();
  try {
    const segsResult = await client.query<SegmentRow>(
      `SELECT id, piece_id, movement_id, measure_start, measure_end
       FROM segments
       WHERE id = ANY($1::int[]) AND piece_id = $2 AND is_active = TRUE`,
      [[leftSegmentId, rightSegmentId], pieceId]
    );

    if (segsResult.rows.length !== 2) return { occurred: false };

    const left = segsResult.rows.find((r) => r.id === leftSegmentId)!;
    const right = segsResult.rows.find((r) => r.id === rightSegmentId)!;

    // Must be truly adjacent and in the same scope
    if (left.measure_end !== right.measure_start) return { occurred: false };
    if (left.movement_id !== right.movement_id) return { occurred: false };

    const cardsResult = await client.query<CardRow>(
      `SELECT id, segment_id, easiness_factor, interval_days, repetitions, is_mastered
       FROM review_cards
       WHERE segment_id = ANY($1::int[]) AND is_active = TRUE`,
      [[leftSegmentId, rightSegmentId]]
    );

    const leftCard = cardsResult.rows.find((r) => r.segment_id === leftSegmentId);
    const rightCard = cardsResult.rows.find((r) => r.segment_id === rightSegmentId);

    if (!leftCard || !rightCard) return { occurred: false };

    return await mergeSegments(client, left, leftCard, right, rightCard);
  } finally {
    client.release();
  }
}

export async function checkAndMerge(segmentId: number, pieceId: number): Promise<MergeEvent> {
  const client = await pool.connect();
  try {
    const segResult = await client.query<SegmentRow>(
      `SELECT id, piece_id, movement_id, measure_start, measure_end
       FROM segments WHERE id = $1 AND is_active = TRUE`,
      [segmentId]
    );
    if (segResult.rows.length === 0) return { occurred: false };
    const seg = segResult.rows[0];

    const cardResult = await client.query<CardRow>(
      `SELECT id, segment_id, easiness_factor, interval_days, repetitions, is_mastered
       FROM review_cards WHERE segment_id = $1 AND is_active = TRUE`,
      [segmentId]
    );
    if (cardResult.rows.length === 0) return { occurred: false };
    const card = cardResult.rows[0];

    // Try right neighbor first, then left — scoped to same movement
    const rightNeighbor = await getMasteredNeighbor(
      client, pieceId, seg.movement_id, seg.measure_end, 'right'
    );
    if (rightNeighbor) {
      return await mergeSegments(client, seg, card, rightNeighbor.seg, rightNeighbor.card);
    }

    const leftNeighbor = await getMasteredNeighbor(
      client, pieceId, seg.movement_id, seg.measure_start, 'left'
    );
    if (leftNeighbor) {
      return await mergeSegments(client, leftNeighbor.seg, leftNeighbor.card, seg, card);
    }

    return { occurred: false };
  } finally {
    client.release();
  }
}

async function getMasteredNeighbor(
  client: PoolClient,
  pieceId: number,
  movementId: number | null,
  boundaryMeasure: number,
  direction: 'right' | 'left'
): Promise<{ seg: SegmentRow; card: CardRow } | null> {
  // right neighbor: its measure_start equals this segment's measure_end
  // left neighbor:  its measure_end equals this segment's measure_start
  const joinCol = direction === 'right' ? 'measure_start' : 'measure_end';

  const result = await client.query<SegmentRow & CardRow & { card_id: number }>(
    `SELECT s.id, s.piece_id, s.movement_id, s.measure_start, s.measure_end,
            rc.id AS card_id, rc.easiness_factor, rc.interval_days,
            rc.repetitions, rc.is_mastered, rc.segment_id
     FROM segments s
     JOIN review_cards rc ON rc.segment_id = s.id AND rc.is_active = TRUE
     WHERE s.piece_id = $1
       AND s.movement_id IS NOT DISTINCT FROM $2
       AND s.${joinCol} = $3
       AND s.is_active = TRUE
       AND rc.is_mastered = TRUE`,
    [pieceId, movementId, boundaryMeasure]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    seg: {
      id: row.id,
      piece_id: row.piece_id,
      movement_id: row.movement_id,
      measure_start: row.measure_start,
      measure_end: row.measure_end,
    },
    card: {
      id: row.card_id,
      segment_id: row.segment_id,
      easiness_factor: row.easiness_factor,
      interval_days: row.interval_days,
      repetitions: row.repetitions,
      is_mastered: row.is_mastered,
    },
  };
}

async function mergeSegments(
  client: PoolClient,
  leftSeg: SegmentRow,
  leftCard: CardRow,
  rightSeg: SegmentRow,
  rightCard: CardRow
): Promise<MergeEvent> {
  try {
    await client.query('BEGIN');

    // 1. Create the merged segment (inherits movement_id from parents)
    const newSegResult = await client.query<{ id: number }>(
      `INSERT INTO segments (piece_id, movement_id, measure_start, measure_end)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [leftSeg.piece_id, leftSeg.movement_id, leftSeg.measure_start, rightSeg.measure_end]
    );
    const newSegId = newSegResult.rows[0].id;

    // 2. Deactivate parent segments
    await client.query(
      `UPDATE segments SET is_active = FALSE, parent_segment_id = $1
       WHERE id = ANY($2::int[])`,
      [newSegId, [leftSeg.id, rightSeg.id]]
    );

    // 3. Deactivate parent cards
    await client.query(
      `UPDATE review_cards SET is_active = FALSE
       WHERE segment_id = ANY($1::int[])`,
      [[leftSeg.id, rightSeg.id]]
    );

    // 4. Create merged card with degraded state (reflects that joining passages is harder)
    const mergedState = computeMergedCardState(
      { easinessFactor: leftCard.easiness_factor, intervalDays: leftCard.interval_days, repetitions: leftCard.repetitions },
      { easinessFactor: rightCard.easiness_factor, intervalDays: rightCard.interval_days, repetitions: rightCard.repetitions }
    );
    await client.query(
      `INSERT INTO review_cards
         (segment_id, piece_id, easiness_factor, interval_days, repetitions, due_at, is_mastered)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
      [newSegId, leftSeg.piece_id, mergedState.easinessFactor,
       mergedState.intervalDays, mergedState.repetitions, mergedState.dueAt]
    );

    // 5. Update piece_progress: net -1 active (removed 2, added 1), -2 mastered
    await client.query(
      `UPDATE piece_progress
       SET active_segments_count   = active_segments_count   - 1,
           mastered_segments_count = mastered_segments_count - 2,
           updated_at              = NOW()
       WHERE piece_id = $1`,
      [leftSeg.piece_id]
    );

    // 6. Check completion for this scope (movement or piece-level)
    await checkScopeCompletion(client, leftSeg.piece_id, leftSeg.movement_id);

    await client.query('COMMIT');

    return {
      occurred: true,
      newSegment: {
        segmentId: newSegId,
        measureStart: leftSeg.measure_start,
        measureEnd: rightSeg.measure_end,
        label: formatLabel(leftSeg.measure_start, rightSeg.measure_end),
      },
      absorbedSegments: [
        { segmentId: leftSeg.id, label: formatLabel(leftSeg.measure_start, leftSeg.measure_end) },
        { segmentId: rightSeg.id, label: formatLabel(rightSeg.measure_start, rightSeg.measure_end) },
      ],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function checkScopeCompletion(
  client: PoolClient,
  pieceId: number,
  movementId: number | null
) {
  // Complete = exactly one active segment in scope, and it is mastered
  const segResult = await client.query(
    `SELECT s.id, rc.is_mastered
     FROM segments s
     JOIN review_cards rc ON rc.segment_id = s.id AND rc.is_active = TRUE
     WHERE s.piece_id = $1
       AND s.movement_id IS NOT DISTINCT FROM $2
       AND s.is_active = TRUE`,
    [pieceId, movementId]
  );

  const scopeComplete =
    segResult.rows.length === 1 && segResult.rows[0].is_mastered === true;

  if (movementId !== null) {
    if (scopeComplete) {
      await client.query(
        `UPDATE movements SET is_complete = TRUE WHERE id = $1`,
        [movementId]
      );
    }
    // Piece is complete only when all its movements are complete
    const mvtResult = await client.query<{ total: string; complete: string }>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE is_complete) AS complete
       FROM movements WHERE piece_id = $1`,
      [pieceId]
    );
    const { total, complete } = mvtResult.rows[0];
    if (parseInt(total) > 0 && total === complete) {
      await client.query(
        `UPDATE piece_progress SET is_complete = TRUE, updated_at = NOW()
         WHERE piece_id = $1`,
        [pieceId]
      );
    }
  } else {
    // No movements — piece-level completion
    if (scopeComplete) {
      await client.query(
        `UPDATE piece_progress SET is_complete = TRUE, updated_at = NOW()
         WHERE piece_id = $1`,
        [pieceId]
      );
    }
  }
}

function formatLabel(start: number, end: number): string {
  return `Measures ${start}–${end}`;
}
