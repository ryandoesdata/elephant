export default function MergeConfirmModal({ pair, onConfirm, onCancel, isPending }) {
  if (!pair) return null;

  const { left, right } = pair;
  const mergedLabel = `Measures ${left.measureStart}–${right.measureEnd - 1}`;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="merge-confirm-title">
      <div className="modal">
        <div className="modal-icon">⊕</div>
        <h2 className="modal-title" id="merge-confirm-title">Merge phrases?</h2>
        <p className="modal-body">
          <strong>{left.label}</strong> and <strong>{right.label}</strong> will be combined
          into <strong>{mergedLabel}</strong>. The new phrase starts as a single review card.
        </p>
        <div className="modal-actions">
          <button className="btn-primary" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Merging…' : 'Merge'}
          </button>
          <button className="btn-ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
