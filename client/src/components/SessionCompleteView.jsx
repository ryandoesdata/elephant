import { useNavigate } from 'react-router-dom';

const RATING_LABELS = ['Again', 'Hard', 'Good', 'Easy'];

export default function SessionCompleteView({ pieceId, summary }) {
  const navigate = useNavigate();
  const total = summary.reduce((sum, count) => sum + count, 0);

  return (
    <div className="session-complete">
      <div className="complete-icon">✓</div>
      <h2>Session complete</h2>
      <p className="complete-total">{total} card{total !== 1 ? 's' : ''} reviewed</p>

      {total > 0 && (
        <div className="rating-summary">
          {RATING_LABELS.map((label, i) =>
            summary[i] > 0 ? (
              <div key={label} className={`rating-summary-item rating-${label.toLowerCase()}`}>
                <span className="summary-count">{summary[i]}</span>
                <span className="summary-label">{label}</span>
              </div>
            ) : null
          )}
        </div>
      )}

      <div className="complete-actions">
        <button className="btn-primary" onClick={() => navigate(`/pieces/${pieceId}`)}>
          Back to piece
        </button>
      </div>
    </div>
  );
}
