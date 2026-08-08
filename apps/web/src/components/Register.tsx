import { formatEther } from 'viem';
import type { AccountReading, Address, ProofWalk } from '@nullius/types';
import { TRUST_LABEL, TRUST_RUBRIC } from '@nullius/types';
import { Mark } from './Marks';

export interface RegisterEntry {
  address: Address;
  label: string;
  reading: AccountReading | null;
  /** What a normal wallet would have shown, per endpoint. */
  unproven: Array<{ label: string; balance: bigint | null; adversarial: boolean }>;
}

/** One vocabulary across every surface — the names PRODUCT.md uses. */
const LABELS = TRUST_LABEL;

/** Formats a wei amount with its unit. Returns e.g. "6.6340 ETH" or "812 wei". */
function amount(v: bigint): string {
  // Dust rendered as "0.00000000 ETH" while the row claims a hundredfold
  // discrepancy reads as a bug. Below a microether, show the honest unit.
  if (v > 0n && v < 1_000_000_000_000n) return `${v.toLocaleString()} wei`;
  const s = formatEther(v);
  const [whole = '0', frac = ''] = s.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (!frac) return `${grouped} ETH`;
  // Small balances need more places or a 100x lie rounds to the same string as
  // the truth, which would make the discrepancy invisible — the one thing this
  // row exists to show.
  const places = whole === '0' ? 8 : 4;
  return `${grouped}.${frac.slice(0, places)} ETH`;
}

export function Register({
  entries,
  selected,
  onSelect,
  showingBroken = false,
  shownWalk = null,
}: {
  entries: RegisterEntry[];
  selected: Address | null;
  onSelect: (a: Address) => void;
  /** True while the walk pane is showing a rejected proof. */
  showingBroken?: boolean;
  /** The walk currently on screen, so provenance describes what is displayed. */
  shownWalk?: ProofWalk | null;
}) {
  const active = entries.find((e) => e.address === selected);
  // Showing the forged figures pushed the provenance block below the register's
  // scroll edge — exactly the state where the rejection needs to be readable. So
  // the rejection leads the panel instead of trailing it.
  const rejection = showingBroken
    ? (active?.reading?.provenance.rejected.find((r) => r.walk) ?? null)
    : null;

  return (
    <div className="register">
      {rejection && (
        <p className="reject-strip">
          <strong>Rejected</strong>
          {rejection.provider.label} — {rejection.reason}. The value below it is what a
          wallet would have shown you.
        </p>
      )}
      {entries.map((entry) => {
        const r = entry.reading;
        const trust = r?.trust ?? 'UNVERIFIABLE';
        const lied = entry.unproven.filter(
          (u) =>
            u.balance !== null &&
            r?.value != null &&
            u.balance !== r.value.balance,
        );

        return (
          <button
            key={entry.address}
            className={`reading reading--${trust.toLowerCase()}`}
            aria-current={entry.address === selected}
            onClick={() => onSelect(entry.address)}
          >
            <span className="reading__mark">
              <Mark trust={trust} witnesses={r?.provenance.attestedBy.length ?? 0} />
            </span>
            <span className="reading__label">{entry.label}</span>
            <span className="reading__trust">{LABELS[trust]}</span>
            <span className="reading__value">
              {r?.value ? amount(r.value.balance) : '—'}
            </span>
            {showingBroken && lied.length > 0 && lied[0]?.balance != null && (
              // The comparison the whole demo rests on: both numbers, at once,
              // rather than the phrase "100× this".
              <span className="reading__forged mono">
                {amount(lied[0].balance)}
                <span className="reading__forged-src"> {lied[0].label}</span>
              </span>
            )}
            <span className="reading__rubric">
              {r ? TRUST_RUBRIC[trust] : 'not yet read'}
              {lied.length > 0 && r?.value != null && (
                <>
                  {' · '}
                  {lied.map((u) => u.label).join(', ')} reported{' '}
                  <span className="mono">
                    {describeLie(r.value.balance, lied[0]?.balance ?? 0n)}
                  </span>{' '}
                  over the unproven channel
                </>
              )}
            </span>
          </button>
        );
      })}

      {active?.reading && (
        <Provenance reading={active.reading} walk={shownWalk ?? active.reading.walk} />
      )}
    </div>
  );
}

/**
 * Describe the discrepancy as a ratio rather than a second decimal figure.
 * A hundredfold lie about a very small balance rounds to the same string as the
 * truth at any sane precision, which would hide the exact thing this line
 * exists to reveal. The multiple never rounds away.
 */
function describeLie(proven: bigint, claimed: bigint): string {
  if (proven > 0n) {
    const ratio = Number(claimed) / Number(proven);
    if (Number.isFinite(ratio) && ratio > 1.05) {
      const shown = ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1);
      return `${shown}× this`;
    }
    if (Number.isFinite(ratio) && ratio < 0.95) {
      return `${(ratio * 100).toFixed(1)}% of this`;
    }
  }
  return amount(claimed);
}

function Provenance({
  reading,
  walk,
}: {
  reading: AccountReading;
  /** The walk on screen — provenance must describe what is displayed. */
  walk: ProofWalk | null;
}) {
  const p = reading.provenance;
  return (
    <div className="provenance">
      <dl>
        {/* Rejections come first: it is the most important thing on this panel
            and it used to sit below the scroll edge. */}
        {p.rejected.length > 0 && (
          <>
            <dt>Rejected</dt>
            <dd style={{ color: 'var(--vermilion-dim)' }}>
              {p.rejected.map((r) => `${r.provider.label} — ${r.reason}`).join(' · ')}
            </dd>
          </>
        )}

        <dt>Answered by</dt>
        <dd>
          {p.provider.label}
          {p.provider.adversarial ? ' (adversarial)' : ''} · {p.latencyMs.toFixed(0)}ms
        </dd>

        <dt>Method issued</dt>
        <dd>
          {p.method} <span style={{ opacity: 0.6 }}>(asked for {p.requestedMethod})</span>
        </dd>

        {p.anchor && (
          <>
            <dt>Root</dt>
            <dd>
              {p.anchor.stateRoot.slice(0, 18)}… @ block{' '}
              {p.anchor.blockNumber.toString()}
            </dd>
          </>
        )}

        {walk && (
          <>
            <dt>Walk shown</dt>
            <dd>
              {walk.steps.length} nodes ·{' '}
              {walk.brokeAt === null ? 'closed' : `broke at node ${walk.brokeAt}`} ·{' '}
              {walk.verifyMs.toFixed(2)}ms
            </dd>
          </>
        )}

        {p.attestedBy.length > 0 && (
          <>
            <dt>Also verified</dt>
            <dd>{p.attestedBy.map((a) => a.label).join(', ')}</dd>
          </>
        )}

      </dl>

      {reading.caveat && (
        <p style={{ margin: 'var(--gap-2) 0 0', maxWidth: '62ch' }}>{reading.caveat}</p>
      )}
    </div>
  );
}
