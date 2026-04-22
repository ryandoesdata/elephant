import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/client';
import { breakSegment } from '../services/splitService';
import { manualMerge } from '../services/mergeService';

const router = Router({ mergeParams: true });

const BreakSchema = z.object({
  midPoint: z.number().int().positive(),
});

const MergeSchema = z.object({
  leftSegmentId: z.number().int().positive(),
  rightSegmentId: z.number().int().positive(),
});

router.get('/', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  if (isNaN(pieceId)) return res.status(400).json({ error: 'Invalid piece ID' });

  const includeInactive = req.query.includeInactive === 'true';

  try {
    const result = await pool.query(
      `SELECT s.id, s.measure_start, s.measure_end, s.is_active,
              s.parent_segment_id, s.created_at,
              rc.id AS card_id, rc.is_mastered, rc.repetitions,
              rc.interval_days, rc.easiness_factor, rc.due_at, rc.last_reviewed_at
       FROM segments s
       LEFT JOIN review_cards rc ON rc.segment_id = s.id AND rc.is_active = s.is_active
       WHERE s.piece_id = $1
         ${includeInactive ? '' : 'AND s.is_active = TRUE'}
       ORDER BY s.measure_start ASC, s.created_at ASC`,
      [pieceId]
    );

    res.json(result.rows.map((row) => ({
      id: row.id,
      measureStart: row.measure_start,
      measureEnd: row.measure_end,
      label: `Measures ${row.measure_start}–${row.measure_end - 1}`,
      isActive: row.is_active,
      parentSegmentId: row.parent_segment_id,
      card: row.card_id ? {
        id: row.card_id,
        isMastered: row.is_mastered,
        repetitions: row.repetitions,
        intervalDays: row.interval_days,
        easinessFactor: row.easiness_factor,
        dueAt: row.due_at,
        lastReviewedAt: row.last_reviewed_at,
      } : null,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch segments' });
  }
});

router.post('/merge', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  if (isNaN(pieceId)) return res.status(400).json({ error: 'Invalid piece ID' });

  const parsed = MergeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { leftSegmentId, rightSegmentId } = parsed.data;

  try {
    const result = await manualMerge(leftSegmentId, rightSegmentId, pieceId);
    if (!result.occurred) {
      return res.status(422).json({ error: 'Cannot merge: segments not found, not adjacent, or not in the same scope' });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to merge segments' });
  }
});

router.post('/:segmentId/break', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  const segmentId = parseInt(req.params.segmentId, 10);
  if (isNaN(pieceId) || isNaN(segmentId)) {
    return res.status(400).json({ error: 'Invalid IDs' });
  }

  const parsed = BreakSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await breakSegment(segmentId, pieceId, parsed.data.midPoint);
    if (!result.occurred) {
      return res.status(422).json({ error: 'Cannot break segment: not found, inactive, or midPoint out of range' });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to break segment' });
  }
});

export default router;
