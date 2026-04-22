// SM-2 spaced repetition algorithm
// Ratings: 0=Again, 1=Hard, 2=Good, 3=Easy

export const MASTERY_THRESHOLD_DAYS = 21;

export interface CardState {
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface ReviewResult extends CardState {
  dueAt: Date;
  isMastered: boolean;
}

export function computeNextState(card: CardState, rating: number): ReviewResult {
  if (rating < 0 || rating > 3) {
    throw new Error(`Invalid rating: ${rating}. Must be 0–3.`);
  }

  let { easinessFactor, intervalDays, repetitions } = card;

  if (rating === 0) {
    // Again: reset to learning, re-queue immediately
    repetitions = 0;
    intervalDays = 0;
    // EF unchanged on first failure
  } else if (rating === 1) {
    // Hard: halve interval, penalize EF
    repetitions = 0;
    intervalDays = Math.max(1, intervalDays * 0.5);
    easinessFactor = Math.max(1.3, easinessFactor - 0.15);
  } else if (rating === 2) {
    // Good: standard SM-2 progression
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 3;
    } else {
      intervalDays = Math.round(intervalDays * easinessFactor);
    }
    repetitions += 1;
  } else {
    // Easy: accelerated progression, boost EF
    if (repetitions === 0) {
      intervalDays = 2;
    } else if (repetitions === 1) {
      intervalDays = 5;
    } else {
      intervalDays = Math.round(intervalDays * easinessFactor * 1.15);
    }
    repetitions += 1;
    easinessFactor = Math.min(4.0, easinessFactor + 0.1);
  }

  const dueAt = new Date();
  if (intervalDays > 0) {
    dueAt.setDate(dueAt.getDate() + Math.round(intervalDays));
  }

  const isMastered = intervalDays >= MASTERY_THRESHOLD_DAYS;

  return { easinessFactor, intervalDays, repetitions, dueAt, isMastered };
}

export function computeMergedCardState(cardA: CardState, cardB: CardState): CardState & { dueAt: Date } {
  const weakerInterval = Math.min(cardA.intervalDays, cardB.intervalDays);
  const newInterval = Math.max(3, Math.floor(weakerInterval * 0.4));
  const avgEF = (cardA.easinessFactor + cardB.easinessFactor) / 2;
  const newEF = Math.max(1.3, avgEF - 0.1);
  const newRepetitions = Math.max(0, Math.min(cardA.repetitions, cardB.repetitions) - 1);

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + newInterval);

  return {
    easinessFactor: newEF,
    intervalDays: newInterval,
    repetitions: newRepetitions,
    dueAt,
  };
}
