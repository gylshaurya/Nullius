import { useState } from 'react';
import type { TrustBoundary } from '@nullius/types';

/**
 * The admitted-assumptions bar.
 *
 * This is structural, not a footnote, and it sits in the first viewport on
 * purpose. A system that catches a server lying earns the right to be believed
 * only if it is equally precise about what it cannot check — so every trust
 * boundary is permanently on screen, hatched like a gap in the evidence, and
 * one click from its exact wording.
 */
export function Admitted({ boundaries }: { boundaries: TrustBoundary[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const active = boundaries.filter((b) => b.active);
  const shown = boundaries.find((b) => b.id === open);

  return (
    <div className="admitted-bar">
      <span className="admitted-bar__lede">Admitted, not proven</span>
      {boundaries.map((b) => (
        <button
          key={b.id}
          className="admitted-chip"
          data-dormant={!b.active}
          aria-expanded={open === b.id}
          onClick={() => setOpen(open === b.id ? null : b.id)}
        >
          <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
            <rect
              x="0.75"
              y="0.75"
              width="7.5"
              height="7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="1.6 1.2"
            />
          </svg>
          {b.claim}
        </button>
      ))}
      <span
        className="admitted-bar__lede"
        style={{ marginLeft: 'auto', marginRight: 0 }}
      >
        {active.length} live
      </span>
      {shown && <p className="admitted-note">{shown.assumption}</p>}
    </div>
  );
}
