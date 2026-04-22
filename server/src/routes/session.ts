import { Router, Request, Response } from 'express';
import { getSessionQueue } from '../services/sessionService';

const router = Router({ mergeParams: true });

router.get('/', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  if (isNaN(pieceId)) return res.status(400).json({ error: 'Invalid piece ID' });

  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

  // movementId scopes the session to a single movement; null = piece-level segments
  const movementId = req.query.movementId
    ? parseInt(req.query.movementId as string, 10)
    : null;

  try {
    const session = await getSessionQueue(pieceId, movementId, limit);
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to build session queue' });
  }
});

export default router;
