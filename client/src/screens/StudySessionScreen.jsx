import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useSubmitReview } from '../hooks/useSubmitReview';
import { useBreakSegment } from '../hooks/useBreakSegment';
import CardDisplay from '../components/CardDisplay';
import RatingButtons from '../components/RatingButtons';
import BreakupSuggestion from '../components/BreakupSuggestion';
import MergeNotification from '../components/MergeNotification';
import SplitNotification from '../components/SplitNotification';
import LessIsMoreWarning from '../components/LessIsMoreWarning';
import SessionCompleteView from '../components/SessionCompleteView';

const STRUGGLE_THRESHOLD = 3;

// How many positions ahead to reinsert a card rated Hard
const HARD_REINSERT_OFFSET = 6;

function reinsert(queue, card, offset) {
  const insertAt = Math.min(offset, queue.length);
  const next = [...queue];
  next.splice(insertAt, 0, card);
  return next;
}

// Always push an Again card to the very end of the queue so it doesn't
// reappear immediately. Exception: if this is the last card (queue is empty),
// it must show again — there's nothing else to show.
function reinsertAgain(queue, card) {
  if (queue.length === 0) return [card];
  return [...queue, card];
}

export default function StudySessionScreen() {
  const { pieceId, movementId } = useParams();
  const navigate = useNavigate();

  // movementId comes from the URL when studying a specific movement
  const parsedMovementId = movementId ? parseInt(movementId, 10) : null;

  const { data: session, isLoading, isError } = useSession(pieceId, parsedMovementId);
  const submitReview = useSubmitReview(pieceId);

  const [queue, setQueue] = useState(null);
  const initialized = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mergeEvent, setMergeEvent] = useState(null);
  const [splitEvent, setSplitEvent] = useState(null);
  const [ratingSummary, setRatingSummary] = useState([0, 0, 0, 0]);

  // Back destination depends on whether we came from a movement or piece
  const backPath = `/pieces/${pieceId}`;

  useEffect(() => {
    if (session && !initialized.current) {
      setQueue(session.cards);
      initialized.current = true;
    }
  }, [session]);

  const currentCard = queue?.[0] ?? null;

  const handleRate = useCallback(async (rating) => {
    if (!currentCard || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const result = await submitReview.mutateAsync({ cardId: currentCard.cardId, rating });

      setRatingSummary((prev) => {
        const next = [...prev];
        next[rating] += 1;
        return next;
      });

      if (result.mergeEvent?.occurred) {
        setMergeEvent(result.mergeEvent);
      }

      if (result.splitEvent?.occurred) {
        setSplitEvent(result.splitEvent);
      }

      setQueue((prev) => {
        const rest = prev.slice(1);
        // If the segment was split, the card is gone — drop it from the queue
        if (result.splitEvent?.occurred) return rest;
        if (rating === 0) return reinsertAgain(rest, currentCard);
        if (rating === 1) return reinsert(rest, currentCard, HARD_REINSERT_OFFSET);
        return rest;
      });
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentCard, isSubmitting, submitReview]);

  if (isLoading || queue === null) {
    return <div className="screen-loading">Loading session…</div>;
  }

  if (isError) {
    return (
      <div className="screen-error">
        <p>Failed to load session.</p>
        <button onClick={() => navigate(backPath)}>Go back</button>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <SessionCompleteView
        pieceId={pieceId}
        summary={ratingSummary}
      />
    );
  }

  const remaining = queue.length;

  return (
    <div className="study-session">
      <header className="session-header">
        <button className="btn-ghost" onClick={() => navigate(backPath)}>
          ← Back
        </button>
        <span className="session-progress">
          {remaining} card{remaining !== 1 ? 's' : ''} remaining
        </span>
      </header>

      {session?.showLessIsMoreWarning && (
        <LessIsMoreWarning newLearnedToday={session.newLearnedToday} />
      )}

      <main className="session-main">
        <CardDisplay card={currentCard} />
        <RatingButtons onRate={handleRate} disabled={isSubmitting} />
      </main>

      <MergeNotification
        mergeEvent={mergeEvent}
        onDismiss={() => setMergeEvent(null)}
      />
      <SplitNotification
        splitEvent={splitEvent}
        onDismiss={() => setSplitEvent(null)}
      />
    </div>
  );
}
