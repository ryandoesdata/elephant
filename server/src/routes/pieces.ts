import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getAllPieces,
  getPieceWithProgress,
  createPiece,
  createMovement,
  addPhrase,
  assignUnassignedSegments,
  deletePiece,
  deleteMovement,
} from '../services/pieceService';
import { pool } from '../db/client';

const router = Router();

// GET /pieces — list all pieces with progress summary
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pieces = await getAllPieces();
    res.json(pieces.map(formatPiece));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pieces' });
  }
});

// GET /pieces/:pieceId — piece detail with movements and segments
router.get('/:pieceId', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  if (isNaN(pieceId)) return res.status(400).json({ error: 'Invalid piece ID' });

  try {
    const piece = await getPieceWithProgress(pieceId);
    if (!piece) return res.status(404).json({ error: 'Piece not found' });

    const segmentsResult = await pool.query(
      `SELECT s.id, s.movement_id, s.measure_start, s.measure_end,
              rc.is_mastered, rc.repetitions, rc.interval_days,
              rc.due_at, rc.last_reviewed_at,
              EXISTS(
                SELECT 1 FROM segments child
                WHERE child.parent_segment_id = s.id
              ) AS is_merged
       FROM segments s
       JOIN review_cards rc ON rc.segment_id = s.id AND rc.is_active = TRUE
       WHERE s.piece_id = $1 AND s.is_active = TRUE
       ORDER BY s.movement_id NULLS FIRST, s.measure_start ASC`,
      [pieceId]
    );

    res.json({
      ...formatPiece(piece),
      movements: piece.movements.map(formatMovement),
      segments: segmentsResult.rows.map(formatSegment),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch piece' });
  }
});

// POST /pieces — create a new piece (no segments yet)
const CreatePieceSchema = z.object({
  title: z.string().min(1),
  composer: z.string().min(1),
  totalMeasures: z.number().int().positive().optional(),
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = CreatePieceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const pieceId = await createPiece(
      parsed.data.title,
      parsed.data.composer,
      parsed.data.totalMeasures
    );
    const piece = await getPieceWithProgress(pieceId);
    res.status(201).json(formatPiece(piece));
  } catch (err) {
    res.status(500).json({ error: 'Failed to create piece' });
  }
});

// DELETE /pieces/:pieceId — delete a piece and all its data
router.delete('/:pieceId', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  if (isNaN(pieceId)) return res.status(400).json({ error: 'Invalid piece ID' });

  try {
    const piece = await getPieceWithProgress(pieceId);
    if (!piece) return res.status(404).json({ error: 'Piece not found' });
    await deletePiece(pieceId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete piece' });
  }
});

// DELETE /pieces/:pieceId/movements/:movementId — delete a movement and its segments
router.delete('/:pieceId/movements/:movementId', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  const movementId = parseInt(req.params.movementId, 10);
  if (isNaN(pieceId) || isNaN(movementId)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  try {
    await deleteMovement(pieceId, movementId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete movement' });
  }
});

// PATCH /pieces/:pieceId/movements/:movementId/claim-phrases
// Reassign all unassigned (movement_id IS NULL) segments on this piece to this movement.
router.patch('/:pieceId/movements/:movementId/claim-phrases', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  const movementId = parseInt(req.params.movementId, 10);
  if (isNaN(pieceId) || isNaN(movementId)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  try {
    const count = await assignUnassignedSegments(pieceId, movementId);
    res.json({ assigned: count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign phrases' });
  }
});

// POST /pieces/:pieceId/movements — add a movement to a piece
const CreateMovementSchema = z.object({
  title: z.string().min(1),
  orderIndex: z.number().int().min(0).optional(),
});

router.post('/:pieceId/movements', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  if (isNaN(pieceId)) return res.status(400).json({ error: 'Invalid piece ID' });

  const parsed = CreateMovementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const movementId = await createMovement(
      pieceId,
      parsed.data.title,
      parsed.data.orderIndex ?? 0
    );
    res.status(201).json({
      id: movementId,
      pieceId,
      title: parsed.data.title,
      orderIndex: parsed.data.orderIndex ?? 0,
      isComplete: false,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create movement' });
  }
});

// Shared phrase validation
const AddPhraseSchema = z
  .object({
    measureStart: z.number().int().min(1),
    measureEnd: z.number().int().min(1),
  })
  .refine((d) => d.measureEnd > d.measureStart, {
    message: 'measureEnd must be greater than measureStart',
  });

// POST /pieces/:pieceId/phrases — add a phrase directly to a piece (no movement)
router.post('/:pieceId/phrases', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  if (isNaN(pieceId)) return res.status(400).json({ error: 'Invalid piece ID' });

  const parsed = AddPhraseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const segmentId = await addPhrase(
      pieceId,
      null,
      parsed.data.measureStart,
      parsed.data.measureEnd
    );
    res.status(201).json({
      id: segmentId,
      movementId: null,
      measureStart: parsed.data.measureStart,
      measureEnd: parsed.data.measureEnd,
      label: `Measures ${parsed.data.measureStart}–${parsed.data.measureEnd}`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add phrase' });
  }
});

// POST /pieces/:pieceId/movements/:movementId/phrases — add a phrase to a movement
router.post('/:pieceId/movements/:movementId/phrases', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  const movementId = parseInt(req.params.movementId, 10);
  if (isNaN(pieceId) || isNaN(movementId)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  const parsed = AddPhraseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const segmentId = await addPhrase(
      pieceId,
      movementId,
      parsed.data.measureStart,
      parsed.data.measureEnd
    );
    res.status(201).json({
      id: segmentId,
      movementId,
      measureStart: parsed.data.measureStart,
      measureEnd: parsed.data.measureEnd,
      label: `Measures ${parsed.data.measureStart}–${parsed.data.measureEnd}`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add phrase' });
  }
});

function formatPiece(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    composer: row.composer,
    totalMeasures: row.total_measures,
    progress: {
      totalSegments: row.total_segments_initial,
      activeSegments: row.active_segments_count,
      masteredSegments: row.mastered_segments_count,
      isComplete: row.is_complete,
    },
  };
}

function formatMovement(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    orderIndex: row.order_index,
    isComplete: row.is_complete,
  };
}

function formatSegment(row: Record<string, unknown>) {
  return {
    id: row.id,
    movementId: row.movement_id,
    measureStart: row.measure_start,
    measureEnd: row.measure_end,
    label: `Measures ${row.measure_start}–${row.measure_end}`,
    isMastered: row.is_mastered,
    isMerged: row.is_merged,
    repetitions: row.repetitions,
    intervalDays: row.interval_days,
    dueAt: row.due_at,
    lastReviewedAt: row.last_reviewed_at,
  };
}

export default router;
