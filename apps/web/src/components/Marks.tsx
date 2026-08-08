import type { TrustLevel } from '@nullius/types';

/**
 * Authored trust marks. Four shapes, one stroke weight, drawn — not glyphs
 * borrowed from a font, and never colour alone: the whole taxonomy must survive
 * a monochrome screenshot, because a trust level a reader cannot distinguish is
 * a trust level the interface did not communicate.
 *
 *   proven        solid filled square — closed, complete
 *   attested      open square with witness ticks — corroborated, not closed
 *   unverifiable  hatched square — a space where a proof would go
 *   rejected      broken square — a proof was offered and it failed
 */
export function Mark({
  trust,
  size = 12,
  witnesses = 0,
}: {
  trust: TrustLevel;
  size?: number;
  witnesses?: number;
}) {
  const s = size;
  const common = {
    width: s,
    height: s,
    viewBox: '0 0 12 12',
    fill: 'none',
    'aria-hidden': true as const,
    className: `mark mark--${trust.toLowerCase()}`,
  };

  if (trust === 'PROVEN') {
    return (
      <svg {...common}>
        <rect x="1.5" y="1.5" width="9" height="9" fill="currentColor" />
      </svg>
    );
  }

  if (trust === 'ATTESTED') {
    const ticks = Math.min(Math.max(witnesses, 1), 3);
    return (
      <svg {...common}>
        <rect
          x="1.5"
          y="1.5"
          width="9"
          height="9"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        {Array.from({ length: ticks }, (_, i) => (
          <rect
            key={i}
            x={3.25 + i * 2}
            y={5}
            width="1.25"
            height="2"
            fill="currentColor"
          />
        ))}
      </svg>
    );
  }

  if (trust === 'UNVERIFIABLE') {
    return (
      <svg {...common}>
        <defs>
          <pattern
            id="hatch-mark"
            width="3"
            height="3"
            patternTransform="rotate(-45)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="3" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect
          x="1.5"
          y="1.5"
          width="9"
          height="9"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeDasharray="2 1.5"
        />
        <rect x="3" y="3" width="6" height="6" fill="url(#hatch-mark)" opacity="0.75" />
      </svg>
    );
  }

  // REJECTED — the square is broken open and the break is drawn
  return (
    <svg {...common}>
      <path
        d="M10.5 1.5H1.5v9h4"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="square"
      />
      <path d="M7 4.5l3.5 6M10.5 4.5L7 10.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

/** The channel a route reached the chain by, drawn at the same weight. */
export function RouteMark({ status }: { status: 'acknowledged' | 'silent' | 'refused' | 'submitted' }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: '0 0 12 12',
    fill: 'none',
    'aria-hidden': true as const,
    className: 'mark',
  };
  if (status === 'acknowledged') {
    return (
      <svg {...common} style={{ color: 'var(--citron)' }}>
        <path d="M1.5 6h9" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="6" r="1.75" fill="currentColor" />
      </svg>
    );
  }
  if (status === 'silent') {
    return (
      <svg {...common} style={{ color: 'var(--vermilion)' }}>
        <path d="M1.5 6h4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 6h.01M9 6h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'refused') {
    return (
      <svg {...common} style={{ color: 'var(--vermilion)' }}>
        <path d="M1.5 6h5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8.5 3.5v5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg {...common} style={{ color: 'var(--ink-on-void-muted)' }}>
      <path d="M1.5 6h9" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  );
}
