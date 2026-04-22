import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePiece } from '../hooks/usePiece';
import { useAddMovement } from '../hooks/useAddMovement';
import { useDeletePiece } from '../hooks/useDeletePiece';
import { useDeleteMovement } from '../hooks/useDeleteMovement';
import { useBreakSegment } from '../hooks/useBreakSegment';
import { useMergeSegments } from '../hooks/useMergeSegments';
import SegmentMap from '../components/SegmentMap';
import ProgressBar from '../components/ProgressBar';
import AddPhraseForm from '../components/AddPhraseForm';
import BreakPhraseModal from '../components/BreakPhraseModal';
import MergeConfirmModal from '../components/MergeConfirmModal';

export default function PieceDetailScreen() {
  const { pieceId } = useParams();
  const navigate = useNavigate();
  const { data: piece, isLoading, isError } = usePiece(pieceId);
  const addMovement = useAddMovement(pieceId);
  const deletePieceMutation = useDeletePiece();
  const deleteMovementMutation = useDeleteMovement(pieceId);
  const breakSegment = useBreakSegment(pieceId);
  const mergeSegments = useMergeSegments(pieceId);
  const [breakingPhrase, setBreakingPhrase] = useState(null);
  const [mergingPair, setMergingPair] = useState(null);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementTitle, setMovementTitle] = useState('');
  const [movementError, setMovementError] = useState('');
  const [expandedMovement, setExpandedMovement] = useState(null);
  const [showDeletePieceConfirm, setShowDeletePieceConfirm] = useState(false);
  const [confirmDeleteMovementId, setConfirmDeleteMovementId] = useState(null);

  if (isLoading) return <div className="screen-loading">Loading…</div>;
  if (isError || !piece) {
    return (
      <div className="screen-error">
        <p>Piece not found.</p>
        <button onClick={() => navigate('/')}>Go home</button>
      </div>
    );
  }

  const { progress, segments = [], movements = [] } = piece;
  const hasMovements = movements.length > 0;

  // Segments grouped by movementId
  function segmentsForScope(movementId) {
    return segments.filter((s) =>
      movementId === null ? s.movementId === null : s.movementId === movementId
    );
  }

  function hasDueCards(scopeSegments) {
    return scopeSegments.some(
      (s) => s.lastReviewedAt === null || new Date(s.dueAt) <= new Date()
    );
  }

  async function handleAddMovement(e) {
    e.preventDefault();
    setMovementError('');
    if (!movementTitle.trim()) return setMovementError('Title is required.');
    try {
      await addMovement.mutateAsync({
        title: movementTitle.trim(),
        orderIndex: movements.length,
      });
      setMovementTitle('');
      setShowMovementForm(false);
    } catch {
      setMovementError('Failed to add movement. Try again.');
    }
  }

  async function handleDeletePiece() {
    await deletePieceMutation.mutateAsync(pieceId);
    navigate('/');
  }

  async function handleDeleteMovement(movementId) {
    await deleteMovementMutation.mutateAsync(movementId);
    setConfirmDeleteMovementId(null);
    if (expandedMovement === movementId) setExpandedMovement(null);
  }

  // The total measure range across all segments (for SegmentMap)
  const allMeasureEnds = segments.map((s) => s.measureEnd);
  const totalMeasures = allMeasureEnds.length > 0 ? Math.max(...allMeasureEnds) : 0;

  async function handleBreak(midPoint) {
    if (!breakingPhrase) return;
    await breakSegment.mutateAsync({ segmentId: breakingPhrase.id, midPoint });
    setBreakingPhrase(null);
  }

  async function handleMerge() {
    if (!mergingPair) return;
    await mergeSegments.mutateAsync({
      leftSegmentId: mergingPair.left.id,
      rightSegmentId: mergingPair.right.id,
    });
    setMergingPair(null);
  }

  return (
    <div className="piece-detail">
      <header className="detail-header">
        <button className="btn-ghost" onClick={() => navigate('/')}>← Library</button>
        <div className="detail-header-actions">
          {progress.isComplete && <span className="complete-badge">Complete!</span>}
          {!showDeletePieceConfirm ? (
            <button
              className="btn-danger btn-small"
              onClick={() => setShowDeletePieceConfirm(true)}
            >
              Delete piece
            </button>
          ) : (
            <div className="delete-confirm-inline">
              <span className="delete-warning-text">Delete "{piece.title}" and all review history?</span>
              <button
                className="btn-danger btn-small"
                onClick={handleDeletePiece}
                disabled={deletePieceMutation.isPending}
              >
                {deletePieceMutation.isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                className="btn-ghost btn-small"
                onClick={() => setShowDeletePieceConfirm(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="detail-info">
        <h1 className="detail-title">{piece.title}</h1>
        <p className="detail-composer">{piece.composer}</p>
        <p className="detail-meta">
          {progress.masteredSegments} / {progress.totalSegments} phrases mastered
        </p>
      </div>

      <ProgressBar
        mastered={progress.masteredSegments}
        total={progress.totalSegments}
      />

      {/* ─── Piece without movements: phrase list + study button ─── */}
      {!hasMovements && (
        <section className="scope-section">
          <div className="scope-header">
            <span className="scope-label">Phrases</span>
            {hasDueCards(segmentsForScope(null)) ? (
              <button
                className="btn-primary btn-small"
                onClick={() => navigate(`/pieces/${pieceId}/study`)}
              >
                Study now
              </button>
            ) : (
              <span className="no-due-label">No cards due</span>
            )}
          </div>

          <SegmentMap segments={segmentsForScope(null)} totalMeasures={totalMeasures} />
          <PhraseList phrases={segmentsForScope(null)} onBreakPhrase={setBreakingPhrase} onMergePair={setMergingPair} />
          <AddPhraseForm
            pieceId={pieceId}
            movementId={null}
            existingPhrases={segments}
          />

          <div className="movement-actions">
            {!showMovementForm && (
              <button
                className="btn-ghost btn-small"
                onClick={() => setShowMovementForm(true)}
              >
                + Split into movements
              </button>
            )}
          </div>
        </section>
      )}

      {/* ─── Piece with movements ─── */}
      {hasMovements && (
        <section className="movements-section">
          {movements.map((mvt) => {
            const mvtSegments = segmentsForScope(mvt.id);
            const isExpanded = expandedMovement === mvt.id;
            const due = hasDueCards(mvtSegments);
            const isConfirmingDelete = confirmDeleteMovementId === mvt.id;

            return (
              <div key={mvt.id} className={`movement-card ${mvt.isComplete ? 'is-complete' : ''}`}>
                <div className="movement-header">
                  <div className="movement-title-row">
                    <button
                      className="movement-toggle btn-ghost"
                      onClick={() =>
                        setExpandedMovement(isExpanded ? null : mvt.id)
                      }
                    >
                      <span className="movement-chevron">{isExpanded ? '▾' : '▸'}</span>
                      <span className="movement-title">{mvt.title}</span>
                    </button>
                    {mvt.isComplete && <span className="complete-badge small">✓</span>}
                  </div>
                  <div className="movement-actions">
                    <span className="movement-phrase-count">
                      {mvtSegments.filter((s) => s.isMastered).length} / {mvtSegments.length} mastered
                    </span>
                    {due ? (
                      <button
                        className="btn-primary btn-small"
                        onClick={() =>
                          navigate(`/pieces/${pieceId}/movements/${mvt.id}/study`)
                        }
                      >
                        Study
                      </button>
                    ) : (
                      <span className="no-due-label">No cards due</span>
                    )}
                    {!isConfirmingDelete ? (
                      <button
                        className="btn-danger btn-small"
                        onClick={() => setConfirmDeleteMovementId(mvt.id)}
                        title="Delete movement"
                      >
                        Delete
                      </button>
                    ) : (
                      <div className="delete-confirm-inline">
                        <span className="delete-warning-text">Delete "{mvt.title}"?</span>
                        <button
                          className="btn-danger btn-small"
                          onClick={() => handleDeleteMovement(mvt.id)}
                          disabled={deleteMovementMutation.isPending}
                        >
                          {deleteMovementMutation.isPending ? 'Deleting…' : 'Yes, delete'}
                        </button>
                        <button
                          className="btn-ghost btn-small"
                          onClick={() => setConfirmDeleteMovementId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="movement-body">
                    <SegmentMap segments={mvtSegments} totalMeasures={
                      mvtSegments.length > 0
                        ? Math.max(...mvtSegments.map((s) => s.measureEnd))
                        : 0
                    } />
                    <PhraseList phrases={mvtSegments} onBreakPhrase={setBreakingPhrase} onMergePair={setMergingPair} />
                    <AddPhraseForm
                      pieceId={pieceId}
                      movementId={mvt.id}
                      existingPhrases={segments}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Add movement form */}
          {showMovementForm ? (
            <form className="add-movement-form" onSubmit={handleAddMovement}>
              <input
                type="text"
                placeholder="Movement title (e.g. I. Allegro molto appassionato)"
                value={movementTitle}
                onChange={(e) => setMovementTitle(e.target.value)}
                autoFocus
              />
              <div className="form-row">
                <button type="submit" className="btn-primary btn-small" disabled={addMovement.isPending}>
                  {addMovement.isPending ? 'Adding…' : 'Add movement'}
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-small"
                  onClick={() => setShowMovementForm(false)}
                >
                  Cancel
                </button>
              </div>
              {movementError && <p className="form-error">{movementError}</p>}
            </form>
          ) : (
            <button
              className="btn-ghost btn-small add-movement-btn"
              onClick={() => setShowMovementForm(true)}
            >
              + Add movement
            </button>
          )}
        </section>
      )}

      <BreakPhraseModal
        segment={breakingPhrase}
        onConfirm={handleBreak}
        onCancel={() => setBreakingPhrase(null)}
        isPending={breakSegment.isPending}
      />
      <MergeConfirmModal
        pair={mergingPair}
        onConfirm={handleMerge}
        onCancel={() => setMergingPair(null)}
        isPending={mergeSegments.isPending}
      />

      {/* Add first movement (when piece has no movements yet and user wants to add one) */}
      {!hasMovements && showMovementForm && (
        <form className="add-movement-form" onSubmit={handleAddMovement}>
          <p className="form-hint">
            Adding a movement will group phrases by movement going forward.
          </p>
          <input
            type="text"
            placeholder="Movement title (e.g. I. Allegro molto appassionato)"
            value={movementTitle}
            onChange={(e) => setMovementTitle(e.target.value)}
            autoFocus
          />
          <div className="form-row">
            <button type="submit" className="btn-primary btn-small" disabled={addMovement.isPending}>
              {addMovement.isPending ? 'Adding…' : 'Add movement'}
            </button>
            <button
              type="button"
              className="btn-ghost btn-small"
              onClick={() => setShowMovementForm(false)}
            >
              Cancel
            </button>
          </div>
          {movementError && <p className="form-error">{movementError}</p>}
        </form>
      )}
    </div>
  );
}

function PhraseList({ phrases, onBreakPhrase, onMergePair }) {
  if (phrases.length === 0) {
    return <p className="empty-phrase-list">No phrases yet. Add one below.</p>;
  }
  return (
    <div className="segment-list-items">
      {phrases.map((seg, i) => {
        const canBreak = seg.measureEnd - seg.measureStart >= 2;
        const next = phrases[i + 1];
        const canMergeNext = next && seg.measureEnd === next.measureStart;
        return (
          <div key={seg.id}>
            <div className={`segment-list-item ${seg.isMastered ? 'is-mastered' : ''}`}>
              <span className="seg-label">{seg.label}</span>
              <div className="seg-actions">
                <span className="seg-status">
                  {seg.isMastered
                    ? seg.isMerged ? 'Mastered (merged)' : 'Mastered'
                    : seg.repetitions === 0
                    ? 'New'
                    : `${seg.repetitions} rep${seg.repetitions !== 1 ? 's' : ''}`}
                </span>
                {canBreak && (
                  <button
                    className="btn-ghost btn-small seg-break-btn"
                    onClick={() => onBreakPhrase(seg)}
                    title="Break into two shorter phrases"
                  >
                    Break up
                  </button>
                )}
              </div>
            </div>
            {canMergeNext && (
              <button
                className="seg-merge-connector"
                onClick={() => onMergePair({ left: seg, right: next })}
                title={`Merge ${seg.label} and ${next.label}`}
              >
                ⊕ Merge
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
