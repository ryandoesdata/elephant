import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/client';
import { computeNextState } from '../services/sm2';
import { checkAndMerge } from '../services/mergeService';
import { shouldSplit, splitSegment } from '../services/splitService';

const router = Router({ mergeParams: true });

const ReviewSchema = z.object({
  cardId: z.number().int().positive(),
  rating: z.number().int().min(0).max(3),
});

router.post('/', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  if (isNaN(pieceId)) return res.status(400).json({ error: 'Invalid piece ID' });

  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { cardId, rating } = parsed.data;

  try {
    // Load the card
    const cardResult = await pool.query(
      `SELECT rc.*, s.id AS seg_id
       FROM review_cards rc
       JOIN segments s ON s.id = rc.segment_id
       WHERE rc.id = $1 AND rc.piece_id = $2 AND rc.is_active = TRUE`,
      [cardId, pieceId]
    );

    if (cardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const card = cardResult.rows[0];
    const segmentId = card.segment_id;

    const prevState = {
      easinessFactor: card.easiness_factor,
      intervalDays: card.interval_days,
      repetitions: card.repetitions,
    };

    // Compute new SM-2 state
    const next = computeNextState(prevState, rating);

    // Update card
    await pool.query(
      `UPDATE review_cards
       SET easiness_factor  = $1,
           interval_days    = $2,
           repetitions      = $3,
           due_at           = $4,
           last_reviewed_at = NOW(),
           is_mastered      = $5
       WHERE id = $6`,
      [next.easinessFactor, next.intervalDays, next.repetitions,
       next.dueAt, next.isMastered, cardId]
    );

    // Log the review
    await pool.query(
      `INSERT INTO review_log
         (card_id, segment_id, piece_id, rating,
          easiness_factor_before, interval_before, interval_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [cardId, segmentId, pieceId, rating,
       prevState.easinessFactor, prevState.intervalDays, next.intervalDays]
    );

    // Update mastered count in piece_progress if mastery status changed
    if (next.isMastered && !card.is_mastered) {
      await pool.query(
        `UPDATE piece_progress
         SET mastered_segments_count = mastered_segments_count + 1, updated_at = NOW()
         WHERE piece_id = $1`,
        [pieceId]
      );
    } else if (!next.isMastered && card.is_mastered) {
      // Regression (Again on a mastered card)
      await pool.query(
        `UPDATE piece_progress
         SET mastered_segments_count = GREATEST(0, mastered_segments_count - 1), updated_at = NOW()
         WHERE piece_id = $1`,
        [pieceId]
      );
    }

    // Check for merge if this card just became mastered
    let mergeEvent = { occurred: false };
    if (next.isMastered && !card.is_mastered) {
      mergeEvent = await checkAndMerge(segmentId, pieceId);
    }

    // Check for split if this is a merged segment that keeps getting struggle ratings
    let splitEvent = { occurred: false };
    if (rating <= 1 && !mergeEvent.occurred) {
      const isMergedSegment = await pool.query<{ has_children: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM segments WHERE parent_segment_id = $1
         ) AS has_children`,
        [segmentId]
      );
      if (isMergedSegment.rows[0].has_children && await shouldSplit(cardId)) {
        splitEvent = await splitSegment(segmentId, pieceId);
      }
    }

    res.json({
      card: {
        cardId,
        newIntervalDays: next.intervalDays,
        easinessFactor: next.easinessFactor,
        repetitions: next.repetitions,
        dueAt: next.dueAt,
        isMastered: next.isMastered,
      },
      mergeEvent,
      splitEvent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

export default router;
