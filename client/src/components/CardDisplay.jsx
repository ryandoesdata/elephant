export default function CardDisplay({ card }) {
  if (!card) return null;

  return (
    <div className="card-display">
      <div className="card-badge">{card.isNew ? 'New' : 'Review'}</div>
      <h2 className="card-label">{card.label}</h2>
      <p className="card-prompt">
        Play this passage from memory, then rate your performance.
      </p>
      {card.repetitions > 0 && (
        <p className="card-meta">
          Interval: {card.intervalDays === 0 ? 'Today' : `${Math.round(card.intervalDays)}d`}
        </p>
      )}
    </div>
  );
}
