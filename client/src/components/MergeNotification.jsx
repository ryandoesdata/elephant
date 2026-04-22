import { useEffect } from 'react';

export default function MergeNotification({ mergeEvent, onDismiss }) {
  useEffect(() => {
    if (!mergeEvent?.occurred) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [mergeEvent, onDismiss]);

  if (!mergeEvent?.occurred) return null;

  return (
    <div className="merge-notification" role="status">
      <span className="merge-icon">⊕</span>
      <div className="merge-text">
        <strong>Passages merged!</strong>
        <span>{mergeEvent.newSegment.label} is now a single passage.</span>
      </div>
    </div>
  );
}
