import { pool } from '../db/client';

const DEFAULT_SESSION_LIMIT = 10;
const MAX_NEW_PER_SESSION = 50;
const NEW_SEGMENT_WARNING_THRESHOLD = 10;

export interface SessionCard {
  cardId: number;
  segmentId: number;
  measureStart: number;
  measureEnd: number;
  label: string;
  isDue: boolean;
  isNew: boolean;
  repetitions: number;
  intervalDays: number;
  easinessFactor: number;
}

export async function getSessionQueue(
  pieceId: number,
  movementId: number | null,
  limit: number = DEFAULT_SESSION_LIMIT
): Promise<{
  cards: SessionCard[];
  totalDue: number;
  totalNew: number;
  newLearnedToday: number;
  showLessIsMoreWarning: boolean;
}> {
  const now = new Date();

  // 1. Count due cards in this scope
  const dueCountResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM review_cards rc
     JOIN segments s ON s.id = rc.segment_id
     WHERE rc.piece_id = $1
       AND s.movement_id IS NOT DISTINCT FROM $2
       AND rc.is_active = TRUE
       AND rc.repetitions > 0
       AND rc.due_at <= $3`,
    [pieceId, movementId, now]
  );
  const totalDue = parseInt(dueCountResult.rows[0].count, 10);

  // 2. Count new (never-reviewed) cards in this scope
  const newCountResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM review_cards rc
     JOIN segments s ON s.id = rc.segment_id
     WHERE rc.piece_id = $1
       AND s.movement_id IS NOT DISTINCT FROM $2
       AND rc.is_active = TRUE
       AND rc.repetitions = 0
       AND rc.last_reviewed_at IS NULL`,
    [pieceId, movementId]
  );
  const totalNew = parseInt(newCountResult.rows[0].count, 10);

  // 3. Fetch due cards (oldest due first)
  const dueResult = await pool.query(
    `SELECT rc.id AS card_id, rc.segment_id, s.measure_start, s.measure_end,
            rc.repetitions, rc.interval_days, rc.easiness_factor
     FROM review_cards rc
     JOIN segments s ON s.id = rc.segment_id
     WHERE rc.piece_id = $1
       AND s.movement_id IS NOT DISTINCT FROM $2
       AND rc.is_active = TRUE
       AND rc.repetitions > 0
       AND rc.due_at <= $3
     ORDER BY rc.due_at ASC
     LIMIT $4`,
    [pieceId, movementId, now, limit]
  );

  const cards: SessionCard[] = dueResult.rows.map((row) => ({
    cardId: row.card_id,
    segmentId: row.segment_id,
    measureStart: row.measure_start,
    measureEnd: row.measure_end,
    label: formatLabel(row.measure_start, row.measure_end),
    isDue: true,
    isNew: false,
    repetitions: row.repetitions,
    intervalDays: row.interval_days,
    easinessFactor: row.easiness_factor,
  }));

  // 4. Backfill with new cards (introduced in measure order — learn from the beginning)
  const newSlotsAvailable = Math.min(limit - cards.length, MAX_NEW_PER_SESSION);
  if (newSlotsAvailable > 0) {
    const newResult = await pool.query(
      `SELECT rc.id AS card_id, rc.segment_id, s.measure_start, s.measure_end,
              rc.repetitions, rc.interval_days, rc.easiness_factor
       FROM review_cards rc
       JOIN segments s ON s.id = rc.segment_id
       WHERE rc.piece_id = $1
         AND s.movement_id IS NOT DISTINCT FROM $2
         AND rc.is_active = TRUE
         AND rc.repetitions = 0
         AND rc.last_reviewed_at IS NULL
       ORDER BY s.measure_start ASC
       LIMIT $3`,
      [pieceId, movementId, newSlotsAvailable]
    );

    for (const row of newResult.rows) {
      cards.push({
        cardId: row.card_id,
        segmentId: row.segment_id,
        measureStart: row.measure_start,
        measureEnd: row.measure_end,
        label: formatLabel(row.measure_start, row.measure_end),
        isDue: false,
        isNew: true,
        repetitions: 0,
        intervalDays: 0,
        easinessFactor: row.easiness_factor,
      });
    }
  }

  // 5. Count distinct new segments first reviewed today in this scope
  //    interval_before = 0 identifies a card's very first review
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  const newTodayResult = await pool.query<{ count: string }>(
    `SELECT COUNT(DISTINCT rl.card_id) AS count
     FROM review_log rl
     JOIN review_cards rc ON rc.id = rl.card_id
     JOIN segments s ON s.id = rc.segment_id
     WHERE rl.piece_id = $1
       AND s.movement_id IS NOT DISTINCT FROM $2
       AND rl.reviewed_at >= $3
       AND rl.interval_before = 0`,
    [pieceId, movementId, todayMidnight]
  );
  const newLearnedToday = parseInt(newTodayResult.rows[0].count, 10);

  return {
    cards,
    totalDue,
    totalNew,
    newLearnedToday,
    showLessIsMoreWarning: newLearnedToday >= NEW_SEGMENT_WARNING_THRESHOLD,
  };
}

function formatLabel(start: number, end: number): string {
  return `Measures ${start}–${end}`;
}
