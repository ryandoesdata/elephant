import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import piecesRouter from './routes/pieces';
import sessionRouter from './routes/session';
import reviewsRouter from './routes/reviews';
import segmentsRouter from './routes/segments';
import statsRouter from './routes/stats';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use('/api/v1/pieces', piecesRouter);
app.use('/api/v1/pieces/:pieceId/session', sessionRouter);
app.use('/api/v1/pieces/:pieceId/reviews', reviewsRouter);
app.use('/api/v1/pieces/:pieceId/segments', segmentsRouter);
app.use('/api/v1/pieces/:pieceId/stats', statsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`elephant server running on http://localhost:${PORT}`);
});
