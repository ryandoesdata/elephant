import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePieces } from '../hooks/usePieces';
import { useAddPiece } from '../hooks/useAddPiece';
import { createMovement } from '../api/pieces';
import PieceCard from '../components/PieceCard';

// Form steps: 'idle' → 'info' → 'ask-movements' → 'add-movements'

export default function PieceListScreen() {
  const navigate = useNavigate();
  const { data: pieces, isLoading, isError } = usePieces();
  const addPiece = useAddPiece();

  const [step, setStep] = useState('idle');
  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [formError, setFormError] = useState('');

  // State for the new piece once created
  const [newPiece, setNewPiece] = useState(null); // { id, title }

  // State for the movements step
  const [movementInput, setMovementInput] = useState('');
  const [movementError, setMovementError] = useState('');
  const [addedMovements, setAddedMovements] = useState([]); // [{ id, title }]
  const [savingMovement, setSavingMovement] = useState(false);

  function resetForm() {
    setStep('idle');
    setTitle('');
    setComposer('');
    setFormError('');
    setNewPiece(null);
    setMovementInput('');
    setMovementError('');
    setAddedMovements([]);
  }

  async function handleCreatePiece(e) {
    e.preventDefault();
    setFormError('');
    if (!title.trim() || !composer.trim()) {
      return setFormError('Title and composer are required.');
    }
    try {
      const piece = await addPiece.mutateAsync({ title: title.trim(), composer: composer.trim() });
      setNewPiece({ id: piece.id, title: piece.title });
      setStep('ask-movements');
    } catch {
      setFormError('Failed to add piece. Try again.');
    }
  }

  async function handleAddMovement(e) {
    e.preventDefault();
    setMovementError('');
    if (!movementInput.trim()) return setMovementError('Movement title is required.');
    setSavingMovement(true);
    try {
      const mvt = await createMovement(newPiece.id, movementInput.trim(), addedMovements.length);
      setAddedMovements((prev) => [...prev, { id: mvt.id, title: movementInput.trim() }]);
      setMovementInput('');
    } catch {
      setMovementError('Failed to add movement. Try again.');
    } finally {
      setSavingMovement(false);
    }
  }

  function handleDone() {
    navigate(`/pieces/${newPiece.id}`);
  }

  return (
    <div className="piece-list-screen">
      <header className="app-header">
        <div className="app-header-row">
          <div>
            <h1 className="app-title">elephant</h1>
            <p className="app-subtitle">Memorize music with spaced repetition</p>
          </div>
          {step === 'idle' ? (
            <button className="btn-primary" onClick={() => setStep('info')}>
              + Add piece
            </button>
          ) : (
            <button className="btn-ghost" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>

        {/* ── Step 1: Title + composer ── */}
        {step === 'info' && (
          <form className="add-piece-form" onSubmit={handleCreatePiece}>
            <div className="add-piece-fields">
              <input
                type="text"
                placeholder="Title (e.g. Violin Concerto in E minor)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
              <input
                type="text"
                placeholder="Composer (e.g. Felix Mendelssohn)"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={addPiece.isPending}>
                {addPiece.isPending ? 'Creating…' : 'Next →'}
              </button>
            </div>
            {formError && <p className="form-error">{formError}</p>}
          </form>
        )}

        {/* ── Step 2: Does it have movements? ── */}
        {step === 'ask-movements' && (
          <div className="add-piece-form">
            <p className="setup-question">
              Does <strong>{newPiece?.title}</strong> have movements?
            </p>
            <div className="setup-choices">
              <button
                className="setup-choice-btn"
                onClick={() => setStep('add-movements')}
              >
                <span className="setup-choice-label">Yes</span>
                <span className="setup-choice-sub">I'll add the movements now</span>
              </button>
              <button
                className="setup-choice-btn"
                onClick={handleDone}
              >
                <span className="setup-choice-label">No</span>
                <span className="setup-choice-sub">Take me straight to adding phrases</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Add movements ── */}
        {step === 'add-movements' && (
          <div className="add-piece-form">
            <p className="setup-question">
              Add movements for <strong>{newPiece?.title}</strong>
            </p>

            {addedMovements.length > 0 && (
              <ol className="added-movements-list">
                {addedMovements.map((m) => (
                  <li key={m.id}>{m.title}</li>
                ))}
              </ol>
            )}

            <form className="add-movement-inline" onSubmit={handleAddMovement}>
              <input
                type="text"
                placeholder="Movement title (e.g. I. Allegro molto appassionato)"
                value={movementInput}
                onChange={(e) => setMovementInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn-primary btn-small" disabled={savingMovement}>
                {savingMovement ? 'Adding…' : '+ Add'}
              </button>
            </form>
            {movementError && <p className="form-error">{movementError}</p>}

            <div className="setup-done-row">
              <button
                className="btn-primary"
                onClick={handleDone}
                disabled={addedMovements.length === 0}
              >
                Done — start adding phrases →
              </button>
              {addedMovements.length === 0 && (
                <p className="form-hint">Add at least one movement to continue.</p>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="piece-list-main">
        {isLoading && <p className="screen-loading">Loading library…</p>}
        {isError && <p className="screen-error">Failed to load pieces.</p>}
        {step === 'idle' && pieces && pieces.length === 0 && (
          <p className="empty-state">No pieces yet. Add one to get started.</p>
        )}
        {step === 'idle' && pieces && pieces.length > 0 && (
          <div className="piece-grid">
            {pieces.map((piece) => (
              <PieceCard key={piece.id} piece={piece} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
