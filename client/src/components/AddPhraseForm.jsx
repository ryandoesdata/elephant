import { useState } from 'react';
import { useAddPhrase } from '../hooks/useAddPhrase';

export default function AddPhraseForm({ pieceId, movementId = null, existingPhrases = [] }) {
  const addPhrase = useAddPhrase(pieceId);

  // Default start to the end of the last phrase (shared boundary note)
  const lastPhrase = existingPhrases
    .filter((s) => s.movementId === movementId)
    .sort((a, b) => b.measureEnd - a.measureEnd)[0];

  const defaultStart = lastPhrase ? lastPhrase.measureEnd : 1;

  const [start, setStart] = useState(String(defaultStart));
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const s = parseInt(start, 10);
    const en = parseInt(end, 10);
    if (isNaN(s) || isNaN(en)) return setError('Enter valid measure numbers.');
    if (en <= s) return setError('End must be greater than start.');

    try {
      await addPhrase.mutateAsync({ movementId, measureStart: s, measureEnd: en });
      // After adding, next start = this end
      setStart(String(en));
      setEnd('');
    } catch {
      setError('Failed to add phrase. Try again.');
    }
  }

  return (
    <form className="add-phrase-form" onSubmit={handleSubmit}>
      <div className="add-phrase-inputs">
        <div className="input-group">
          <label htmlFor={`start-${movementId}`}>Start</label>
          <input
            id={`start-${movementId}`}
            type="number"
            min="1"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="1"
          />
        </div>
        <span className="input-sep">–</span>
        <div className="input-group">
          <label htmlFor={`end-${movementId}`}>End</label>
          <input
            id={`end-${movementId}`}
            type="number"
            min="1"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="e.g. 5"
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="btn-small btn-primary"
          disabled={addPhrase.isPending}
        >
          {addPhrase.isPending ? '…' : 'Add'}
        </button>
      </div>
      {lastPhrase && (
        <p className="add-phrase-hint">
          Previous phrase ends at {lastPhrase.measureEnd} — next can start there.
        </p>
      )}
      {error && <p className="add-phrase-error">{error}</p>}
    </form>
  );
}
