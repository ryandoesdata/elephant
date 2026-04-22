import { useNavigate } from 'react-router-dom';

export default function PieceCard({ piece }) {
  const navigate = useNavigate();
  const { progress } = piece;
  const pct = progress.totalSegmentsInitial > 0
    ? Math.round((progress.masteredSegments / progress.totalSegmentsInitial) * 100)
    : 0;

  return (
    <div className="piece-card" onClick={() => navigate(`/pieces/${piece.id}`)}>
      <div className="piece-card-body">
        <h2 className="piece-card-title">{piece.title}</h2>
        <p className="piece-card-composer">{piece.composer}</p>
        {piece.movement && <p className="piece-card-movement">{piece.movement}</p>}
      </div>
      <div className="piece-card-footer">
        <div className="mini-progress-track">
          <div className="mini-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="piece-card-pct">{pct}%</span>
        {progress.isComplete && <span className="complete-badge">Complete</span>}
      </div>
    </div>
  );
}
