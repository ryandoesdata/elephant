export default function ProgressBar({ mastered, total }) {
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  return (
    <div className="progress-bar-wrapper">
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-bar-label">{mastered} / {total} segments mastered ({pct}%)</span>
    </div>
  );
}
