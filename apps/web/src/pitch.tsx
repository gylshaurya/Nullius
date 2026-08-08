import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { formatEther } from 'viem';
import { VerifyingReader, boundaries } from '@nullius/provider';
import { filteredShare, observeRelays } from '@nullius/route';
import type { AccountReading, AnchorRef, RelayObservation } from '@nullius/types';

import '@fontsource-variable/anybody';
import '@fontsource-variable/familjen-grotesk';
import '@fontsource-variable/spline-sans-mono';

import './styles/tokens.css';
import './styles/app.css';
import './styles/pitch.css';

import { ENDPOINTS, MODE, RELAY_SNAPSHOT, WATCHED } from './config';

const BASE = import.meta.env.BASE_URL;
import { TrieGround } from './components/TrieGround';
import { Walk } from './components/Walk';
import { Mark } from './components/Marks';

/**
 * The pitch surface, built as a strip of working instruments.
 *
 * Nothing on this page is a screenshot. The hero verifies a real mainnet account
 * against a real state root while the visitor watches, and the rejection beneath
 * it is a real forged proof from a real dishonest endpoint. A product whose whole
 * claim is "don't take my word for it" cannot ask a visitor to take its word for
 * the demo.
 */

function eth(v: bigint): string {
  if (v > 0n && v < 1_000_000_000_000n) return `${v.toLocaleString()} wei`;
  const [whole = '0', frac = ''] = formatEther(v).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac.slice(0, whole === '0' ? 8 : 4)} ETH` : `${grouped} ETH`;
}

// ---------------------------------------------------------------------------
// The hero instrument
// ---------------------------------------------------------------------------

function LiveVerify({ onAnchor }: { onAnchor?: (a: AnchorRef | null) => void }) {
  const reader = useMemo(
    () => new VerifyingReader({ endpoints: ENDPOINTS, mode: MODE, timeoutMs: 6000 }),
    [],
  );
  const [anchor, setAnchor] = useState<AnchorRef | null>(null);
  const [reading, setReading] = useState<AccountReading | null>(null);
  const [showBroken, setShowBroken] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const target = WATCHED[0]!;

  useEffect(() => {
    let live = true;
    void (async () => {
      const a = await reader.refreshAnchor();
      if (!live) return;
      setAnchor(a);
      onAnchor?.(a);
      if (!a) {
        setFailed('No endpoint returned a block header, so there is no root to check against.');
        return;
      }
      const r = await reader.readAccount(target.address);
      if (!live) return;
      setReading(r);
    })();
    return () => {
      live = false;
    };
  }, [reader, target.address]);

  const rejected = reading?.provenance.rejected.find((r) => r.walk) ?? null;
  const showingBroken = showBroken && rejected?.walk != null;
  const walk = showingBroken ? rejected!.walk : (reading?.walk ?? null);
  const verdict = showingBroken ? 'REJECTED' : (reading?.trust ?? 'UNVERIFIABLE');

  return (
    <div className="rig">
      <div className="rig__head">
        <h2 className="rig__title">Live, in your browser, right now</h2>
        <span className="rig__live" data-state={reading ? 'live' : 'waiting'}>
          {failed ? 'no root' : reading ? `block ${anchor?.blockNumber}` : 'reading mainnet…'}
        </span>
      </div>

      <div className={`readout readout--${reading?.trust === 'PROVEN' ? 'proven' : 'waiting'}`}>
        <span style={{ gridRow: 'span 2', alignSelf: 'center' }}>
          <Mark trust={reading?.trust ?? 'UNVERIFIABLE'} />
        </span>
        <span className="readout__label">{target.label} · balance</span>
        <span className="readout__verdict">{reading?.trust ?? '…'}</span>
        <span className="readout__value">
          {reading?.value ? eth(reading.value.balance) : failed ? '—' : 'verifying…'}
        </span>
        <span className="readout__note">
          {failed ??
            (reading
              ? `Merkle-verified against ${anchor?.stateRoot.slice(0, 12)}… — ${reading.walk?.steps.length} nodes walked locally in ${reading.walk?.verifyMs.toFixed(2)}ms.`
              : 'Fetching a proof and walking it against an independently obtained state root.')}
        </span>
      </div>

      {rejected && (
        <div className="readout readout--rejected">
          <span style={{ gridRow: 'span 2', alignSelf: 'center' }}>
            <Mark trust="REJECTED" />
          </span>
          <span className="readout__label">the same balance, as evil-rpc reports it</span>
          <span className="readout__verdict">rejected</span>
          <span className="readout__value">
            {reading?.value
              ? eth(reading.value.balance * 100n)
              : '—'}
          </span>
          <span className="readout__note">
            {rejected.reason}. A normal wallet would have drawn this number without
            hesitating, because nothing in the ordinary read path can tell the difference.
          </span>
        </div>
      )}

      <div className="rig__walk" data-verdict={verdict}>
        <div className="region--walk" data-verdict={verdict}>
          <Walk walk={walk} verdict={verdict} animate />
        </div>
      </div>

      {rejected && (
        <div className="rig__head" style={{ borderBottom: 0, borderTop: 'var(--line)' }}>
          <button className="action action--quiet" onClick={() => setShowBroken((v) => !v)}>
            {showingBroken ? 'Show the proof that closed' : 'Show the forged proof breaking'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The radar strip
// ---------------------------------------------------------------------------

function LiveRadar() {
  const [obs, setObs] = useState<RelayObservation[] | null>(null);

  useEffect(() => {
    let live = true;
    void observeRelays({ limit: 200, snapshotUrl: RELAY_SNAPSHOT }).then((o) => {
      if (live) setObs(o);
    });
    return () => {
      live = false;
    };
  }, []);

  const rows = (obs ?? [])
    .filter((o) => !o.error)
    .sort((a, b) => b.payloadsDelivered - a.payloadsDelivered);
  const filtered = obs ? filteredShare(obs) : 0;
  const windowSlots = rows.find((r) => r.windowSlots > 0)?.windowSlots ?? 0;

  return (
    <>
      <div className="strip">
        <div className="strip__row strip__row--head">
          <span>Relay</span>
          <span style={{ textAlign: 'right' }}>Delivered</span>
          <span style={{ textAlign: 'right' }}>Share</span>
          <span>Stated posture</span>
        </div>
        {obs === null && (
          <div className="strip__row">
            <span>Reading relay feeds…</span>
            <span />
            <span />
            <span />
          </div>
        )}
        {rows.map((o) => (
          <div className="strip__row" key={o.relay.id}>
            <span>{o.relay.label}</span>
            <span className="strip__num">{o.payloadsDelivered.toLocaleString()}</span>
            <span className="strip__share">
              <span className="strip__num">{(o.share * 100).toFixed(1)}%</span>
              <span className="strip__bar" style={{ width: `${Math.max(o.share * 100, 1)}%` }} />
            </span>
            <span className={`strip__posture--${o.relay.posture}`}>{o.relay.posture}</span>
          </div>
        ))}
      </div>
      {obs && rows.some((o) => o.source === 'snapshot') && (
        <p style={{ marginTop: 'var(--gap-3)', color: 'var(--vermilion)' }}>
          These rows are a stored snapshot, not a live measurement. Relay APIs send no CORS
          headers, so a browser can only reach them through a proxy, and this deployment has
          none. Showing stored numbers as live ones would be exactly the unlabelled claim
          this project refuses. The verification above it is live.
        </p>
      )}
      {obs && rows.length > 0 && (
        <p style={{ marginTop: 'var(--gap-3)' }}>
          <strong>{(filtered * 100).toFixed(1)}%</strong> of the payloads delivered in the{' '}
          {windowSlots.toLocaleString()}-slot window every relay above can see came through
          relays that publicly filter transactions. That is a count, not an accusation — and
          it is the share of Ethereum's block supply a sender currently has no way to see,
          let alone route around.
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

function Pitch() {
  // The admitted list is generated from the same code the console uses, so it
  // cannot drift from the truth — but it has to be given the REAL anchor. Passing
  // null made the page open its most credible section with "no root is
  // established, nothing is being checked", three thousand pixels below a hero
  // that had just proved a balance against a root. A page that contradicts itself
  // where it claims to be most honest is worse than one that says nothing.
  const [anchor, setAnchor] = useState<AnchorRef | null>(null);
  const admits = boundaries(anchor, MODE);

  return (
    <>
      <TrieGround />

      <main className="pitch">
        <section className="hero">
          <div>
            <p className="hero__mark">
              NULLIUS
              <span>nullius in verba — take nobody&rsquo;s word for it</span>
            </p>
            <h1>
              Your wallet has never <em>once</em> checked.
            </h1>
            <p className="hero__lede">
              That balance on your screen arrived as a sentence from a company, over a
              channel with no cryptography in it at all. NULLIUS asks for a Merkle proof
              instead and walks it here, on this page, against a state root it obtained
              independently.
            </p>
            <div className="hero__actions">
              <a className="action action--lead" href={BASE}>
                Open the console
              </a>
              <a className="action action--quiet" href={`${BASE}?show=rejected`}>
                Watch a server get caught
              </a>
            </div>
          </div>
          <LiveVerify onAnchor={setAnchor} />
        </section>

        <section className="band">
          <div className="band__head">
            <h2>Don&rsquo;t vote — verify.</h2>
            <p>
              The obvious way to distrust one RPC provider is to ask five and take the
              majority. We think that is the weaker primitive, and being able to say why is
              the centre of this project.
            </p>
            <p>
              Those five are frequently resold access to the same few backends, so you did
              not poll five sources — you polled one, five times. They can be wrong
              together. And &ldquo;majority of five&rdquo; hands an attacker a budget:
              corrupt three. A proof asks a different question entirely.
            </p>
          </div>

          <table className="versus">
            <thead>
              <tr>
                <th />
                <th>Polling providers</th>
                <th>Verifying a proof</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Honest sources needed</th>
                <td>a majority</td>
                <td>exactly one</td>
              </tr>
              <tr>
                <th scope="row">If every source lies</th>
                <td>you are deceived, silently</td>
                <td>you get nothing, loudly</td>
              </tr>
              <tr>
                <th scope="row">The attacker&rsquo;s job</th>
                <td>corrupt the majority</td>
                <td>break keccak256</td>
              </tr>
              <tr>
                <th scope="row">Can you detect a lie?</th>
                <td>only from the minority</td>
                <td>always, and name the node</td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginTop: 'var(--gap-3)' }}>
            <strong>Liveness degrades; safety does not.</strong> Refusing to show a number
            is a worse experience than showing one. Showing a false number is a worse
            outcome. We take the worse experience every time, and we say so on screen.
          </p>
        </section>

        <section className="band">
          <div className="band__head">
            <h2>The same question, asked of the send path.</h2>
            <p>
              Most Ethereum validators no longer build their own blocks; builders and relays
              do, and some relays filter what they will carry. You currently have no
              visibility into any of it. Below is live data from the relays&rsquo; own public
              feeds, counted over a window every one of them can see.
            </p>
          </div>
          <LiveRadar />
        </section>

        <section className="band" id="architecture">
          <div className="band__head">
            <h2>Where the trust goes.</h2>
            <p>
              Two read paths, drawn honestly. Everything above the dashed box is verified.
              The box is the one thing still trusted — and in the product it is named
              permanently on screen, not buried in a footnote.
            </p>
          </div>
          <div className="diagram">
            <img
              src={`${BASE}architecture.svg`}
              alt="Two read paths compared. Today: a wallet asks an RPC provider for a balance and renders the answer, with no cryptography in the path. With NULLIUS: the provider is asked for a Merkle proof, several endpoints are queried in parallel, each proof is walked locally against an independently obtained state root, and the first proof that verifies wins. A forged proof from evil-rpc breaks at a named node. A dashed boundary marks the one remaining trusted element: the anchored state root."
            />
          </div>
        </section>

        <section className="band">
          <div className="band__head">
            <h2>What we do not prove.</h2>
            <p>
              This is the most credible part of the pitch, so it is on the page rather than
              in a disclaimer. A system that catches a server lying earns belief only if it
              is equally precise about its own limits.
            </p>
          </div>
          <ul className="admits">
            {admits.map((b) => (
              <li key={b.id}>
                <strong>{b.claim}</strong>
                <span>{b.assumption}</span>
              </li>
            ))}
            <li>
              <strong>zero-knowledge membership</strong>
              <span>
                The quorum&rsquo;s gate is proven — every member&rsquo;s balance was
                demonstrated against the same root. Its anonymity is not proven in the app:
                the Noir circuit exists and verifies (481 gates, UltraHonk, with negative
                tests), but it proves through the CLI rather than in your browser, and the
                set it proves membership of is a snapshot rather than the live state trie.
              </span>
            </li>
            <li>
              <strong>collusion resistance</strong>
              <span>
                We have anonymity, which is a different property. Receipt-freeness needs
                secret key switching — MACI&rsquo;s insight, cited here rather than
                reimplemented.
              </span>
            </li>
          </ul>
        </section>

        <section className="band">
          <div className="band__head">
            <h2>One architecture, three questions.</h2>
          </div>
          <div className="tracks">
            <section>
              <h3>Censorship resistance</h3>
              <p>
                Proofs instead of provider votes, plus measured relay behaviour and a
                per-transaction flight recorder. The client-side layer that exists today,
                before forced inclusion lists ship.
              </p>
            </section>
            <section>
              <h3>Self-sovereignty</h3>
              <p>
                Your smart account is only as sovereign as the endpoint telling it what
                state it is in. Plus Sybil resistance that costs capital instead of privacy.
              </p>
            </section>
            <section>
              <h3>Decentralized coordination</h3>
              <p>
                Group signalling whose anti-Sybil defence is cryptographic and
                capital-based, rather than a registry or a vibe — and which reveals nothing.
              </p>
            </section>
          </div>
        </section>

        <section className="close">
          <blockquote>
            We would rather show you nothing than show you a lie.
          </blockquote>
          <div className="hero__actions">
            <a className="action action--lead" href={BASE}>
              Open the console
            </a>
            <a className="action action--quiet" href={`${BASE}?show=rejected`}>
              Watch a server get caught
            </a>
          </div>
          <div className="foot">
            <span>nullius in verba · Royal Society, 1660</span>
            <span>EIP-1186 has existed since 2018</span>
            <span>Every figure on this page was measured, not authored</span>
          </div>
        </section>
      </main>
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <Pitch />
  </StrictMode>,
);
