import { pool } from './client';
import { createPiece, createMovement, addPhrase } from '../services/pieceService';

// NOTE: If you have old seeded data from a previous schema, run:
//   dropdb memorizeit && createdb memorizeit && npm run migrate --workspace=server
// before re-seeding.

const PIECES = [
  {
    title: 'Violin Concerto in E minor',
    composer: 'Felix Mendelssohn',
    movements: [
      { title: 'I. Allegro molto appassionato', totalMeasures: 490 },
      { title: 'II. Andante', totalMeasures: 108 },
      { title: 'III. Allegretto non troppo — Allegro molto vivace', totalMeasures: 330 },
    ],
    phraseSize: 4,
  },
];

async function seed() {
  for (const piece of PIECES) {
    // Check by title + composer + whether movements already exist
    const { rows: existingMovements } = await pool.query(
      `SELECT m.id FROM movements m
       JOIN pieces p ON p.id = m.piece_id
       WHERE p.title = $1 AND p.composer = $2`,
      [piece.title, piece.composer]
    );

    if (existingMovements.length > 0) {
      console.log(`  skip  "${piece.title}" (already seeded with movements)`);
      continue;
    }

    // Re-use existing piece row if present, otherwise create fresh
    const { rows: existingPieces } = await pool.query(
      `SELECT id FROM pieces WHERE title = $1 AND composer = $2`,
      [piece.title, piece.composer]
    );

    let pieceId: number;
    if (existingPieces.length > 0) {
      pieceId = existingPieces[0].id;
      console.log(`  reusing piece "${piece.title}" (id=${pieceId})`);
    } else {
      pieceId = await createPiece(piece.title, piece.composer);
      console.log(`  created piece "${piece.title}" (id=${pieceId})`);
    }

    for (const [i, movement] of piece.movements.entries()) {
      const movementId = await createMovement(pieceId, movement.title, i);

      // Generate phrases using shared-boundary convention:
      //   phrase 1: start=1,  end=1+size  (e.g. 1–5)
      //   phrase 2: start=5,  end=9       (shares boundary note at 5)
      //   ...
      //   last phrase ends at totalMeasures
      let phraseCount = 0;
      for (
        let start = 1;
        start < movement.totalMeasures;
        start += piece.phraseSize
      ) {
        const end = Math.min(start + piece.phraseSize, movement.totalMeasures);
        await addPhrase(pieceId, movementId, start, end);
        phraseCount++;
      }

      console.log(
        `    seeded movement "${movement.title}" with ${phraseCount} phrases`
      );
    }
  }

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
