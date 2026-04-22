import { useState } from 'react';

export default function LessIsMoreWarning({ newLearnedToday }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="less-is-more-warning" role="alert">
      <div className="warning-content">
        <span className="warning-icon">⚠️</span>
        <div className="warning-text">
          <strong>Less is more.</strong>
          <span>
            You've started {newLearnedToday} new segments today. Every segment you add now
            comes due again tomorrow — the more you add today, the heavier tomorrow's
            review load will be. Consistent daily practice beats big cramming sessions.
          </span>
        </div>
      </div>
      <button
        className="warning-dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss warning"
      >
        ✕
      </button>
    </div>
  );
}
