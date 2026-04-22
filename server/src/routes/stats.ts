import { Router, Request, Response } from 'express';
import { pool } from '../db/client';

const router = Router({ mergeParams: true });

router.get('/', async (req: Request, res: Response) => {
  const pieceId = parseInt(req.params.pieceId, 10);
  if (isNaN(pieceId)) return res.status(400).json({ error: 'Invalid piece ID' });

  try {
    // Total reviews and rating breakdown
    const summaryResult = await pool.query(
      `SELECT
         COUNT(*) AS total_reviews,
         SUM(CASE WHEN rating = 0 THEN 1 ELSE 0 END) AS again_count,
         SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS hard_count,
         SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS good_count,
         SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS easy_count,
         AVG(rating) AS avg_rating
       FROM review_log
       WHERE piece_id = $1`,
      [pieceId]
    );

    // Daily activity (last 30 days)
    const dailyResult = await pool.query(
      `SELECT
         DATE(reviewed_at) AS day,
         COUNT(*) AS reviews
       FROM review_log
       WHERE piece_id = $1
         AND reviewed_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(reviewed_at)
       ORDER BY day ASC`,
      [pieceId]
    );

    const s = summaryResult.rows[0];
    res.json({
      totalReviews: parseInt(s.total_reviews, 10),
      ratings: {
        again: parseInt(s.again_count, 10),
        hard: parseInt(s.hard_count, 10),
        good: parseInt(s.good_count, 10),
        easy: parseInt(s.easy_count, 10),
      },
      avgRating: s.avg_rating ? parseFloat(s.avg_rating) : null,
      dailyActivity: dailyResult.rows.map((r) => ({
        day: r.day,
        reviews: parseInt(r.reviews, 10),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
