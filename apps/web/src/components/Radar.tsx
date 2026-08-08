import type { RelayObservation } from '@nullius/types';

/**
 * The censorship radar. Every number here is counted from a relay's own public
 * data feed. Nothing is inferred: a relay's filtering posture is a documented
 * fact about its operator, and inclusion delay is left empty because it cannot
 * honestly be derived from this feed alone — an empty cell that says so beats a
 * computed-looking number we could not defend.
 */
export function Radar({
  observations,
  loading,
  filtered,
}: {
  observations: RelayObservation[];
  loading: boolean;
  filtered: number;
}) {
  const ordered = [...observations].sort((a, b) => b.payloadsDelivered - a.payloadsDelivered);
  const anyData = ordered.some((o) => o.payloadsDelivered > 0);
  const slotWindow = ordered.find((o) => o.windowSlots > 0)?.windowSlots ?? 0;
  // Stored rows must never be presented as live ones.
  const stored = ordered.find((o) => o.source === 'snapshot');

  return (
    <>
      <table className="radar-table">
        <thead>
          <tr>
            <th scope="col">Relay</th>
            <th scope="col">Posture</th>
            <th scope="col" style={{ textAlign: 'right' }}>
              Delivered
            </th>
            <th scope="col" style={{ textAlign: 'right' }}>
              Builders
            </th>
            <th scope="col" style={{ textAlign: 'right' }}>
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((o) => (
            <tr
              key={o.relay.id}
              className={[
                o.relay.posture === 'filtering' ? 'radar-row--filtering' : '',
                o.error ? 'radar-row--error' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <td>{o.relay.label}</td>
              <td>
                <span className={`posture posture--${o.relay.posture}`}>
                  {o.relay.posture}
                </span>
              </td>
              <td className="num">
                {o.error ? '—' : o.payloadsDelivered.toLocaleString()}
              </td>
              <td className="num">{o.error ? '—' : o.builders}</td>
              <td className="num">
                {o.error ? (
                  '—'
                ) : (
                  <>
                    {(o.share * 100).toFixed(1)}%
                    <span
                      className="share-bar"
                      style={{ width: `${Math.max(o.share * 100, 0.5)}%` }}
                    />
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="radar__summary">
        {loading && !anyData ? (
          <>Reading relay data feeds…</>
        ) : anyData ? (
          <>
            <strong>{(filtered * 100).toFixed(1)}%</strong> of the payloads delivered in
            the {slotWindow.toLocaleString()}-slot window every relay that answered can see were
            delivered by relays that publicly filter transactions. That is a count, not an
            accusation — and it is the share of Ethereum's block supply a sender currently
            has no way to see, let alone route around. Inclusion delay is not shown because
            it cannot be derived from this feed alone; measuring it needs per-transaction
            first-seen times, which is what the flight recorder collects.
            {stored && (
              <>
                {' '}
                <strong style={{ color: 'var(--vermilion-dim)', fontSize: 'var(--step--1)' }}>
                  These rows are a stored snapshot from{' '}
                  {new Date(stored.observedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC,
                  not a live measurement.
                </strong>{' '}
                Relay APIs send no CORS headers, so a browser can only reach them through a
                proxy. This deployment has none, and showing stored numbers as live ones would
                be exactly the unlabelled claim this project refuses. Run it locally for live
                data.
              </>
            )}
          </>
        ) : (
          <>
            No relay feed answered. Rows are shown with their errors rather than hidden,
            because an empty table reads as “nothing is happening”, which would be a claim
            we have not earned. Relay data needs network access and the dev-server proxy.
          </>
        )}
      </div>
    </>
  );
}
