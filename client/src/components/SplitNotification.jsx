import { useEffect } from 'react';

export default function SplitNotification({ splitEvent, onDismiss }) {
  useEffect(() => {
    if (!splitEvent?.occurred) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [splitEvent, onDismiss]);

  if (!splitEvent?.occurred) return null;

  const [a, b] = splitEvent.restoredSegments;

  return (
    <div className="split-notification" role="status">
      <span className="split-icon">⊘</span>
      <div className="split-text">
        <strong>Passage split for focused practice</strong>
        <span>{a.label} and {b.label} will appear separately next session.</span>
      </div>
    </div>
  );
}
