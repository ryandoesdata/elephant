import { useEffect } from 'react';

const RATINGS = [
  { value: 0, label: 'Again', key: '1', className: 'btn-again', description: 'I had to practice this passage before I could play it from memory.' },
  { value: 1, label: 'Hard',  key: '2', className: 'btn-hard',  description: 'I had to refresh my memory for this passage.' },
  { value: 2, label: 'Good',  key: '3', className: 'btn-good',  description: "I wasn't 100% confident or had a small memory slip." },
  { value: 3, label: 'Easy',  key: '4', className: 'btn-easy',  description: 'Nailed it.' },
];

export default function RatingButtons({ onRate, disabled }) {
  useEffect(() => {
    if (disabled) return;
    function handleKey(e) {
      const rating = RATINGS.find((r) => r.key === e.key);
      if (rating) onRate(rating.value);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onRate, disabled]);

  return (
    <div className="rating-buttons-wrapper">
      <p className="rating-hint">Practice until you can play it from memory, then rate.</p>
      <div className="rating-buttons">
        {RATINGS.map((r) => (
          <button
            key={r.value}
            className={`rating-btn ${r.className}`}
            onClick={() => onRate(r.value)}
            disabled={disabled}
          >
            <span className="rating-label">{r.label}</span>
            <span className="rating-key">{r.key}</span>
            <span className="rating-description">{r.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
