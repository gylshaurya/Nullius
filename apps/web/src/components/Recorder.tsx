import type { FlightRecord } from '@nullius/types';
import { RouteMark } from './Marks';

/**
 * The flight recorder. A transaction is multicast across routes and each route's
 * behaviour is recorded separately — the comparison is the product, so routes
 * are never raced for a single winner.
 *
 * Inclusion is currently ATTESTED, not PROVEN: proving it means rebuilding the
 * block's transaction trie locally and checking its root against the header.
 * The machinery exists in @nullius/provider; wiring it is the documented next
 * step, and until it is wired this panel says so rather than implying a proof.
 */
export function Recorder({
  record,
  sending,
  onSend,
  error,
}: {
  record: FlightRecord | null;
  sending: boolean;
  onSend: () => void;
  error: string | null;
}) {
  return (
    <div className="sub">
      <div className="sub__head">
        <h3 className="sub__title">Flight recorder</h3>
        <p className="region__note" style={{ color: 'var(--ink-on-void-muted)' }}>
          per-route
        </p>
        <button
          className="action"
          style={{ marginLeft: 'auto' }}
          onClick={onSend}
          disabled={sending}
        >
          {sending ? 'Broadcasting…' : 'Multicast a transaction'}
        </button>
      </div>

      <div className="sub__body">
        {error && <p className="caveat">{error}</p>}

        {!record && !error && (
          <p style={{ maxWidth: '54ch' }}>
            Sending a transaction normally means dropping it into one endpoint and hoping.
            This broadcasts one signed transaction across every route at once — including
            a deliberately silent route — and records what each one did.
          </p>
        )}

        {record && (
          <>
            <p className="mono" style={{ color: 'var(--ink-on-void)', wordBreak: 'break-all' }}>
              {record.txHash}
            </p>

            {record.receipts.map((r, i) => {
              const ms =
                r.acknowledgedAt !== null ? r.acknowledgedAt - record.submittedAt : null;
              return (
                <div
                  key={`${r.route.id}-${i}`}
                  className={`receipt${r.status === 'silent' ? ' receipt--silent' : ''}`}
                >
                  <RouteMark status={r.status} />
                  <span className="receipt__label">
                    {r.route.label}
                    <span style={{ opacity: 0.6 }}> · {r.channel}</span>
                    {r.error && <span style={{ opacity: 0.75 }}> · {r.error}</span>}
                  </span>
                  <span className="receipt__time">
                    {r.status === 'silent' ? 'no reply' : ms !== null ? `${ms}ms` : '—'}
                  </span>
                </div>
              );
            })}

            <p className="caveat">
              {record.receipts.some((r) => r.status === 'silent')
                ? 'A route accepted this transaction and never acknowledged it. From the sender’s side that is indistinguishable from censorship — which is the point: without a record like this one, you would never have known.'
                : 'Every route acknowledged. Acknowledgement is self-reported, so this record is reported, not proven, until an inclusion proof lands.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
