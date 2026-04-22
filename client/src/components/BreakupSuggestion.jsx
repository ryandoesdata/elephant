export default function BreakupSuggestion({ suggestion, onBreakup, onDismiss, isBreaking }) {
  if (!suggestion?.show) return null;

  const { cardLabel, newLabels } = suggestion;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="breakup-title">
      <div className="modal">
        <div className="modal-icon">✂</div>
        <h2 className="modal-title" id="breakup-title">Consider breaking this up</h2>
        <p className="modal-body">
          <strong>{cardLabel}</strong> has been a consistent challenge over multiple sessions.
          Breaking it into two shorter phrases will let you build confidence in each half separately.
        </p>
        {newLabels && (
          <div className="breakup-halves">
            {newLabels.map((label) => (
              <span key={label} className="breakup-half-badge">{label}</span>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn-primary" onClick={onBreakup} disabled={isBreaking}>
            {isBreaking ? 'Breaking up…' : 'Break it up'}
          </button>
          <button className="btn-ghost" onClick={onDismiss} disabled={isBreaking}>
            Keep practicing as-is
          </button>
        </div>
      </div>
    </div>
  );
}
