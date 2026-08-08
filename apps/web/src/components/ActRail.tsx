import type { Act, ActId } from '@nullius/types';

/**
 * The act rail drives the real panels — it is not a slideshow beside them.
 * Selecting an act re-reads, re-broadcasts, or re-gates the actual modules.
 */
export function ActRail({
  acts,
  current,
  onSelect,
  busy,
}: {
  acts: Act[];
  current: ActId | null;
  onSelect: (id: ActId) => void;
  busy: boolean;
}) {
  return (
    <nav className="rail" aria-label="Demonstrations">
      {acts.map((act) => (
        <button
          key={act.id}
          className="act"
          aria-current={current === act.id}
          onClick={() => onSelect(act.id)}
          disabled={busy}
          title={act.claim}
        >
          <span className="act__numeral">{act.numeral}</span>
          <span className="act__title">{act.title}</span>
        </button>
      ))}
      <div className="rail__foot">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke={busy ? 'var(--citron)' : 'var(--void-edge)'}
            strokeWidth="1.25"
            strokeDasharray={busy ? '4 3' : undefined}
          />
        </svg>
      </div>
    </nav>
  );
}
