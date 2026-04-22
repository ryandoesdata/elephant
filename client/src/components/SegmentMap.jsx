// Color coding:
//   gray        = never reviewed (new)
//   yellow      = learning (repetitions 1-2)
//   green       = familiar (repetitions >= 3, not mastered)
//   teal        = mastered
//   dark teal   = mastered + was created by a merge

function getSegmentStatus(segment) {
  if (segment.repetitions === 0) return 'new';
  if (segment.isMastered) {
    return segment.isMerged ? 'mastered-merged' : 'mastered';
  }
  if (segment.repetitions <= 2) return 'learning';
  return 'familiar';
}

export default function SegmentMap({ segments, totalMeasures }) {
  if (!segments || segments.length === 0) return null;

  const range = totalMeasures || Math.max(...segments.map((s) => s.measureEnd));

  return (
    <div className="segment-map" role="img" aria-label="Memorization progress map">
      <div className="segment-map-bar">
        {segments.map((seg) => {
          const width = ((seg.measureEnd - seg.measureStart) / range) * 100;
          const status = getSegmentStatus(seg);
          return (
            <div
              key={seg.id}
              className={`segment-block segment-${status}`}
              style={{ width: `${Math.max(width, 0.5)}%` }}
              title={`${seg.label} — ${status}`}
            />
          );
        })}
      </div>
      <div className="segment-map-legend">
        <span className="legend-item segment-new">New</span>
        <span className="legend-item segment-learning">Learning</span>
        <span className="legend-item segment-familiar">Familiar</span>
        <span className="legend-item segment-mastered">Mastered</span>
        <span className="legend-item segment-mastered-merged">Merged</span>
      </div>
    </div>
  );
}
