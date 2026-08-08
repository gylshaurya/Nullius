import { useMemo, useState } from 'react';
import { poseidon2 } from 'poseidon-lite';
import { formatEther, keccak256, toHex } from 'viem';
import type { AccountReading } from '@nullius/types';
import { MOTION } from '../config';

/**
 * nullius/quorum — a signal gated on proven holdings rather than on identity.
 *
 * WHAT IS REAL HERE, and stated plainly because overclaiming would cost more
 * than the module is worth:
 *
 *   The GATE is proven. Every member of this set had its balance demonstrated
 *   against the same state root by a Merkle proof, in this browser. No registry,
 *   no KYC, no snapshot taken on trust.
 *
 *   The NULLIFIER is real. It is Poseidon(secret, topic), so one member gets one
 *   signal per motion and the tag reveals nothing about which member.
 *
 *   The ANONYMITY is NOT proven in this build. Making membership zero-knowledge
 *   requires the Noir circuit in nullius/id; without it, membership is asserted
 *   rather than demonstrated. This panel says so, and does not pretend otherwise.
 *
 *   COLLUSION RESISTANCE is a separate property again, and we do not have it.
 *   Anonymity does not stop vote-selling — receipt-freeness does, and that needs
 *   key switching. That is MACI's insight, it is cited, and it is not rebuilt.
 */

const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function toField(hex: `0x${string}`): bigint {
  return BigInt(hex) % FIELD;
}

/**
 * Secrets are minted once per address per session and held outside React.
 *
 * They used to be generated inside a useMemo keyed on the readings, so any
 * re-read — including running act I — minted fresh secrets, produced fresh
 * nullifiers, and let the same member signal again. That directly falsified this
 * panel's own claim that one member gets one signal. In the real construction
 * the secret is the account's own key material and never changes.
 */
const SESSION_SECRETS = new Map<string, bigint>();

function secretFor(address: string): bigint {
  const existing = SESSION_SECRETS.get(address);
  if (existing !== undefined) return existing;
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  const secret = toField(toHex(bytes));
  SESSION_SECRETS.set(address, secret);
  return secret;
}

interface Member {
  label: string;
  balance: bigint;
  secret: bigint;
  commitment: bigint;
}

type Choice = 'for' | 'against' | 'abstain';

export function Quorum({
  readings,
  gateWei,
}: {
  readings: Array<{ label: string; reading: AccountReading | null }>;
  gateWei: bigint;
}) {
  const [signals, setSignals] = useState<Array<{ nullifier: bigint; choice: Choice }>>([]);
  const [me, setMe] = useState<number>(0);

  const members = useMemo<Member[]>(() => {
    return readings
      .filter(
        (r) =>
          r.reading?.trust === 'PROVEN' &&
          r.reading.value != null &&
          r.reading.value.balance >= gateWei,
      )
      .map((r) => {
        const address = r.reading!.value!.address;
        const secret = secretFor(address);
        const addrField = toField(keccak256(address));
        return {
          label: r.label,
          balance: r.reading!.value!.balance,
          secret,
          commitment: poseidon2([secret, addrField]),
        };
      });
  }, [readings, gateWei]);

  const root = useMemo(() => {
    if (members.length === 0) return 0n;
    let level = members.map((m) => m.commitment);
    while (level.length > 1) {
      const next: bigint[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const a = level[i] as bigint;
        const b = level[i + 1] ?? a;
        next.push(poseidon2([a, b]));
      }
      level = next;
    }
    return level[0] as bigint;
  }, [members]);

  const topic = useMemo(() => toField(keccak256(toHex(MOTION))), []);

  const cast = (choice: Choice) => {
    const member = members[me];
    if (!member) return;
    const nullifier = poseidon2([member.secret, topic]);
    setSignals((prev) =>
      prev.some((s) => s.nullifier === nullifier) ? prev : [...prev, { nullifier, choice }],
    );
  };

  const tally = {
    for: signals.filter((s) => s.choice === 'for').length,
    against: signals.filter((s) => s.choice === 'against').length,
    abstain: signals.filter((s) => s.choice === 'abstain').length,
  };
  const lead = Math.max(tally.for, tally.against, tally.abstain);
  const alreadySignalled =
    members[me] !== undefined &&
    signals.some((s) => s.nullifier === poseidon2([members[me]!.secret, topic]));

  return (
    <div className="sub">
      <div className="sub__head">
        <h3 className="sub__title">Quorum</h3>
        <p className="region__note" style={{ color: 'var(--ink-on-void-muted)' }}>
          gate proven · anonymity not
        </p>
      </div>

      <div className="sub__body">
        <p style={{ maxWidth: '56ch' }}>{MOTION}</p>

        {members.length === 0 ? (
          <p className="caveat">
            No member qualifies yet. The set is built only from accounts whose balance was
            demonstrated against the current root at or above{' '}
            <span className="mono">{formatEther(gateWei)} ETH</span> — nothing is admitted
            on the strength of an unverified read.
          </p>
        ) : (
          <>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0,1fr)',
                gap: '2px var(--gap-2)',
                margin: 'var(--gap-2) 0',
                fontSize: 'var(--step--2)',
              }}
            >
              <dt style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>Set</dt>
              <dd style={{ margin: 0, color: 'var(--ink-on-void)' }}>
                {members.length} accounts, each balance proven ≥{' '}
                {formatEther(gateWei)} ETH
              </dd>
              <dt style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>Root</dt>
              <dd
                className="mono"
                style={{ margin: 0, color: 'var(--ink-on-void)', wordBreak: 'break-all' }}
              >
                {root.toString(16).slice(0, 24)}…
              </dd>
            </dl>

            <div className="tally">
              {(['for', 'against', 'abstain'] as const).map((k) => (
                <div
                  key={k}
                  className="tally__cell"
                  data-lead={lead > 0 && tally[k] === lead ? 'true' : 'false'}
                >
                  <span className="tally__n">{tally[k]}</span>
                  <span className="tally__k">{k}</span>
                </div>
              ))}
            </div>

            <label
              style={{
                display: 'flex',
                gap: 'var(--gap-2)',
                alignItems: 'center',
                margin: 'var(--gap-2) 0',
                fontSize: 'var(--step--2)',
              }}
            >
              Signal as
              <select
                value={me}
                onChange={(e) => setMe(Number(e.target.value))}
                style={{
                  font: 'inherit',
                  fontFamily: 'var(--face-mono)',
                  background: 'var(--void)',
                  color: 'var(--ink-on-void)',
                  border: '1px solid var(--void-edge)',
                  padding: '4px 6px',
                }}
              >
                {members.map((m, i) => (
                  <option key={m.label} value={i}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: 'var(--gap-2)', flexWrap: 'wrap' }}>
              {(['for', 'against', 'abstain'] as const).map((c) => (
                <button
                  key={c}
                  className="action action--quiet"
                  onClick={() => cast(c)}
                  disabled={alreadySignalled}
                >
                  {c}
                </button>
              ))}
            </div>

            {alreadySignalled && (
              <p style={{ fontSize: 'var(--step--2)', marginTop: 'var(--gap-2)' }}>
                This member's nullifier is already spent for this motion. One signal per
                member, enforced by the tag rather than by a moderator.
              </p>
            )}

            <p className="caveat">
              The gate is proven — every member's balance was demonstrated against the
              current root. The anonymity is not proven <em>in this panel</em>: membership
              here is asserted. The Noir circuit that makes it zero-knowledge exists and
              verifies (<span className="mono">packages/id</span> — 481 gates, UltraHonk,
              with negative tests), but it proves through the CLI, not yet in the browser.
              And anonymity would still not be collusion resistance: receipt-freeness
              requires secret key switching, which is MACI's insight and is cited here
              rather than reimplemented.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
