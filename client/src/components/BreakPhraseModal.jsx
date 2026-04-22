import { useState } from 'react';

export default function BreakPhraseModal({ segment, onConfirm, onCancel, isPending }) {
  if (!segment) return null;

  // Display measures are measureStart..measureEnd-1 (inclusive).
  // splitAfter: last measure of left half. Range: measureStart to measureEnd-2.
  const displayEnd = segment.measureEnd;
  const defaultSplit = segment.measureStart + Math.floor((displayEnd - segment.measureStart) / 2);
  const min = segment.measureStart;
  const max = displayEnd - 1;

  const [rawInput, setRawInput] = useState(String(defaultSplit));

  const parsed = parseInt(rawInput, 10);
  const isValid = !isNaN(parsed) && parsed >= min && parsed <= max;

  const leftLabel = isValid ? `Measures ${segment.measureStart}–${parsed}` : '—';
  const rightLabel = isValid ? `Measures ${parsed}–${displayEnd}` : '—';

  function handleConfirm() {
    if (!isValid) return;
    onConfirm(parsed + 1);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="break-title">
      <div className="modal">
        <h2 className="modal-title" id="break-title">Break up {segment.label}</h2>
        <p className="modal-body">
          Choose where to split. Both halves will start as new cards.
        </p>

        <div className="break-split-control">
          <label className="break-split-label" htmlFor="split-after">
            Split after measure
          </label>
          <input
            id="split-after"
            type="number"
            className="break-split-input"
            value={rawInput}
            min={min}
            max={max}
            onChange={(e) => setRawInput(e.target.value)}
            onBlur={() => {
              if (!isValid) setRawInput(String(defaultSplit));
            }}
          />
        </div>

        <div className="break-preview">
          <span className="break-preview-half">{leftLabel}</span>
          <span className="break-preview-sep">+</span>
          <span className="break-preview-half">{rightLabel}</span>
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={handleConfirm} disabled={isPending || !isValid}>
            {isPending ? 'Breaking up…' : 'Break it up'}
          </button>
          <button className="btn-ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
