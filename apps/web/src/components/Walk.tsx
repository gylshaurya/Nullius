import { useMemo } from 'react';
import type { ProofWalk, TrustLevel } from '@nullius/types';

/**
 * THE WALK — the signature view, and the reason this world was chosen.
 *
 * It is not a decorative tree. Each row is one real trie node from the proof,
 * in order, root at the top. The sixteen ticks across a row are the sixteen
 * branch slots that actually exist in a Merkle-Patricia branch node, and the
 * lit tick is the slot the path key genuinely descends into. Extension and leaf
 * nodes consume several nibbles at once, so they are drawn as a bar spanning
 * exactly the nibbles they consume.
 *
 * The consequence: when a provider serves a forged proof, the path stops at a
 * specific row and the break is drawn where it happened. You are not being told
 * that verification failed — you are looking at the node that failed.
 */

const SLOTS = 16;
const VB_W = 340;
/**
 * Row height is constant, and deliberately small enough that even the deepest
 * realistic walk stays WIDTH-bound rather than height-bound.
 *
 * That is what keeps the scale identical between states. `meet` scales by
 * whichever axis is tighter, so as long as every walk is width-bound, and the
 * viewBox width never changes, a 5-node proof and a 9-node proof render at
 * exactly the same type size — and the two states a judge toggles between stay
 * comparable. A constant viewBox HEIGHT would also fix the scale, but it fixes
 * it to the height-bound case, which is smaller; this keeps the diagram large.
 */
const ROW_H = 13;
const PAD_TOP = 10;
const SLOT_X0 = 42;
const SLOT_X1 = 258;
const SLOT_W = (SLOT_X1 - SLOT_X0) / SLOTS;

function slotCenter(slot: number): number {
  return SLOT_X0 + slot * SLOT_W + SLOT_W / 2;
}

interface Row {
  index: number;
  kind: ProofWalk['steps'][number]['kind'];
  hash: string;
  y: number;
  /** Where the path sits horizontally on this row. */
  anchorX: number;
  /** Branch slot, or null for extension/leaf. */
  slot: number | null;
  /** Width in slots for extension/leaf bars. */
  span: number;
  broken: boolean;
  /** This node's hash does not match the reference its parent holds. */
  mismatch: boolean;
}

export function Walk({
  walk,
  verdict,
  animate,
}: {
  walk: ProofWalk | null;
  verdict: TrustLevel;
  animate: boolean;
}) {
  const rows = useMemo<Row[]>(() => {
    if (!walk) return [];
    let cursorSlot = 0;
    return walk.steps.map((step, i) => {
      const broken = walk.brokeAt === step.index;
      let anchorX: number;
      let span = 1;
      if (step.kind === 'branch' && step.branchSlot !== null && step.branchSlot < SLOTS) {
        cursorSlot = step.branchSlot;
        anchorX = slotCenter(step.branchSlot);
      } else if (step.kind === 'branch') {
        // Path exhausted at a branch: the value lives in slot 16, drawn past
        // the last tick so it reads as "off the end of the branch".
        anchorX = SLOT_X1 + SLOT_W / 2;
      } else {
        span = Math.max(1, Math.min(step.nibblesConsumed, SLOTS - cursorSlot));
        anchorX = slotCenter(cursorSlot) + ((span - 1) * SLOT_W) / 2;
      }
      return {
        index: step.index,
        kind: step.kind,
        hash: step.hash,
        y: PAD_TOP + i * ROW_H,
        anchorX,
        slot: step.kind === 'branch' ? step.branchSlot : null,
        span,
        broken,
        mismatch: step.matchesParent === false,
      };
    });
  }, [walk]);

  if (!walk || rows.length === 0) {
    return (
      <p className="walk__empty">
        No walk yet. Select an account in the register and the path from the state root
        down to its leaf will be verified locally, node by node, and drawn here.
      </p>
    );
  }

  const height = PAD_TOP * 2 + rows.length * ROW_H;
  const brokenIdx = walk.brokeAt;
  // Every tick on a forged path is forged, not just the node that broke. None of
  // them may wear citron, which is reserved for proof.
  const brokenWalk = brokenIdx !== null;
  // The mismatched node has no slot to sit on, so the path stops at the last
  // node that actually verified and the break is drawn below it.
  const drawable =
    brokenIdx === null
      ? rows
      : rows.filter((r) => r.index <= brokenIdx && !r.mismatch);
  const points = drawable.map((r) => `${r.anchorX.toFixed(1)},${r.y.toFixed(1)}`).join(' ');
  const pathLen = drawable.reduce((sum, r, i) => {
    if (i === 0) return 0;
    const prev = drawable[i - 1] as Row;
    return sum + Math.hypot(r.anchorX - prev.anchorX, r.y - prev.y);
  }, 0);

  return (
    <div className="walk">
      <div className="walk__legend">
        <span>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect
              x="4"
              y="1"
              width="4"
              height="10"
              fill={brokenWalk ? 'var(--stroke-on-vermilion)' : 'var(--citron)'}
            />
          </svg>
          slot taken
        </span>
        <span>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="4" y="1" width="4" height="10" fill="rgba(255,255,255,.22)" />
          </svg>
          not taken
        </span>
        <span>
          <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden="true">
            <rect
              x="2"
              y="4"
              width="16"
              height="4"
              fill={brokenWalk ? 'var(--stroke-on-vermilion)' : 'var(--citron)'}
            />
          </svg>
          span of nibbles consumed
        </span>
        <span className="mono">
          br branch · ex extension · lf leaf
        </span>
        <span className="mono">
          {walk.steps.length} nodes · {walk.verifyMs.toFixed(2)}ms local
        </span>
      </div>

      <p className="walk__empty" style={{ paddingTop: 0, paddingBottom: 'var(--gap-2)' }}>
        {brokenIdx === null ? (
          <>
            The walk closed: every node hashes to the reference its parent holds, the path
            spells <span className="mono">{walk.pathKey.slice(0, 10)}…</span>, and the root
            is the one this session is anchored to.
          </>
        ) : (
          <>
            Node <span className="mono">{String(brokenIdx).padStart(2, '0')}</span> does
            not hash to the reference its parent holds, so the claimed value is not in this
            state — whatever the endpoint said.
          </>
        )}
      </p>

      <svg
        className="walk__svg"
        viewBox={`0 0 ${VB_W} ${height}`}
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label={
          brokenIdx === null
            ? `Verified path of ${rows.length} trie nodes from state root to account leaf.`
            : `Path broke at node ${brokenIdx} of ${rows.length}: its hash does not match the reference held by its parent.`
        }
      >
        {rows.map((row) => {
          const isBranch = row.kind === 'branch' && row.slot !== null;
          if (row.mismatch) {
            // The node we were handed does not hash to the reference its parent
            // holds. There is no slot to light, so the row states the mismatch
            // rather than drawing a path segment that does not exist.
            // No rule is drawn on this row: the path does not continue through
            // it, and a rule would strike through the only text that matters.
            return (
              <g key={row.index}>
                <text className="node-depth" x={SLOT_X0 - 12} y={row.y + 3} textAnchor="end">
                  {String(row.index).padStart(2, '0')}
                </text>
                <text
                  className="node-hash"
                  x={SLOT_X0 + 2}
                  y={row.y + 3}
                  style={{ fill: 'var(--ink-on-ultra)', fontWeight: 500 }}
                >
                  {row.hash === '0x' ? 'no usable node' : row.hash.slice(2, 10)} ≠ parent
                  reference
                </text>
                {/* The break marks this row's terminus, right of the text. It used
                    to be drawn below the last good row, which collided with this
                    text once the rows tightened. */}
                <line
                  className="walk__break"
                  x1={SLOT_X1 + 18}
                  y1={row.y - 4}
                  x2={SLOT_X1 + 26}
                  y2={row.y + 4}
                />
                <line
                  className="walk__break"
                  x1={SLOT_X1 + 26}
                  y1={row.y - 4}
                  x2={SLOT_X1 + 18}
                  y2={row.y + 4}
                />
              </g>
            );
          }
          return (
            <g key={row.index}>
              <line
                className={`walk__row-rule${row.index <= (brokenIdx ?? rows.length) ? ' walk__row-rule--active' : ''}`}
                x1={SLOT_X0 - 6}
                y1={row.y}
                x2={SLOT_X1 + 6}
                y2={row.y}
              />
              <text className="node-depth" x={SLOT_X0 - 12} y={row.y + 3} textAnchor="end">
                {String(row.index).padStart(2, '0')}
              </text>

              {isBranch
                ? Array.from({ length: SLOTS }, (_, s) => {
                    const taken = s === row.slot;
                    const cls = taken
                      ? row.broken || brokenWalk
                        ? 'slot-tick slot-tick--broken'
                        : 'slot-tick slot-tick--taken'
                      : 'slot-tick';
                    return (
                      <rect
                        key={s}
                        className={cls}
                        x={SLOT_X0 + s * SLOT_W + SLOT_W / 2 - 1.25}
                        y={row.y - 5}
                        width="2.5"
                        height="10"
                        data-animate={animate && taken ? 'true' : undefined}
                        style={
                          animate && taken
                            ? { animationDelay: `${row.index * 55}ms` }
                            : undefined
                        }
                      />
                    );
                  })
                : (
                    <rect
                      className={
                        row.broken || brokenWalk
                          ? 'slot-tick slot-tick--broken'
                          : 'slot-tick slot-tick--taken'
                      }
                      x={row.anchorX - (row.span * SLOT_W) / 2}
                      y={row.y - 3}
                      width={row.span * SLOT_W}
                      height="6"
                      data-animate={animate ? 'true' : undefined}
                      style={animate ? { animationDelay: `${row.index * 55}ms` } : undefined}
                    />
                  )}

              <text className="node-hash" x={SLOT_X1 + 14} y={row.y + 3}>
                {row.kind === 'branch' ? 'br' : row.kind === 'extension' ? 'ex' : 'lf'}{' '}
                {row.hash.slice(2, 10)}
              </text>
            </g>
          );
        })}

        {drawable.length > 1 && (
          <polyline
            className={`walk__path${brokenIdx !== null ? ' walk__path--broken' : ''}`}
            points={points}
            data-animate={animate ? 'true' : undefined}
            style={{ '--len': pathLen } as React.CSSProperties}
          />
        )}

      </svg>
    </div>
  );
}
