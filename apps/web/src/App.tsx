import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createWalletClient, http, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import { VerifyingReader, boundaries } from '@nullius/provider';
import { RELAYS, filteredShare, multicast, observeRelays, type SendRoute } from '@nullius/route';
import type {
  AccountReading,
  ActId,
  Address,
  AnchorRef,
  FlightRecord,
  RelayObservation,
} from '@nullius/types';

import { ACTS, ENDPOINTS, GATE_WEI, MODE, SEND_RPC, WATCHED } from './config';
import { TrieGround } from './components/TrieGround';
import { Admitted } from './components/Admitted';
import { Register, type RegisterEntry } from './components/Register';
import { Walk } from './components/Walk';
import { Radar } from './components/Radar';
import { Recorder } from './components/Recorder';
import { Quorum } from './components/Quorum';
import { ActRail } from './components/ActRail';

/** Anvil's first dev account. Funded on any fork; no secret is being leaked. */
const ANVIL_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

export function App() {
  const reader = useMemo(
    () => new VerifyingReader({ endpoints: ENDPOINTS, mode: MODE, timeoutMs: 5000 }),
    [],
  );

  const [anchor, setAnchor] = useState<AnchorRef | null>(null);
  const [entries, setEntries] = useState<RegisterEntry[]>(
    WATCHED.map((w) => ({ ...w, reading: null, unproven: [] })),
  );
  const [selected, setSelected] = useState<Address | null>(WATCHED[0]?.address ?? null);
  const [observations, setObservations] = useState<RelayObservation[]>(
    RELAYS.map((relay) => ({
      relay,
      windowSlots: 0,
      payloadsDelivered: 0,
      share: 0,
      builders: 0,
      lastSeenSlot: null,
      medianDelaySlots: null,
      error: null,
      observedAt: 0,
    })),
  );
  const [radarLoading, setRadarLoading] = useState(true);
  const [record, setRecord] = useState<FlightRecord | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [act, setAct] = useState<ActId | null>(null);
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  /**
   * The honest endpoint wins the race every time, so the broken walk would never
   * be drawn without this. Showing the rejected proof is the whole argument, so
   * it gets a control rather than being buried in a provenance line.
   */
  const [showRejected, setShowRejected] = useState(
    () => new URLSearchParams(window.location.search).get('show') === 'rejected',
  );
  const walkNonce = useRef(0);

  // ---- reads ------------------------------------------------------------

  const readAll = useCallback(async () => {
    setBusy(true);
    setReadError(null);
    try {
      const a = await reader.refreshAnchor();
      setAnchor(a);
      if (!a) {
        setReadError(
          'No endpoint returned a block header, so there is no root to check anything against. Check network access, and start the liar with `pnpm evil` if it is not running. Nothing is displayed unchecked in the meantime.',
        );
      }

      const next = await Promise.all(
        WATCHED.map(async (w): Promise<RegisterEntry> => {
          const [reading, unproven] = await Promise.all([
            reader.readAccount(w.address),
            reader.readBalanceUnverified(w.address, true),
          ]);
          return {
            ...w,
            reading,
            unproven: unproven.map((u) => ({
              label: u.provider.label,
              balance: u.balance,
              adversarial: u.provider.adversarial,
            })),
          };
        }),
      );
      walkNonce.current += 1;
      setEntries(next);
    } finally {
      setBusy(false);
    }
  }, [reader]);

  useEffect(() => {
    void readAll();
  }, [readAll]);

  // ---- radar ------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const obs = await observeRelays({ limit: 200 });
      if (cancelled) return;
      setObservations(obs);
      setRadarLoading(false);
    };
    void run();
    const timer = setInterval(() => void run(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // ---- multicast --------------------------------------------------------

  const send = useCallback(async () => {
    setSending(true);
    setSendError(null);
    try {
      const evil = ENDPOINTS.find((e) => e.id === 'evil-rpc');

      const account = privateKeyToAccount(ANVIL_KEY);
      const wallet = createWalletClient({
        account,
        chain: mainnet,
        transport: http(SEND_RPC),
      });
      const request = await wallet.prepareTransactionRequest({
        to: account.address,
        value: 0n,
      });
      const raw = await wallet.signTransaction(request);
      const txHash = keccak256(raw);

      const routes: SendRoute[] = [
        {
          ref: { id: 'anvil', label: 'anvil · local fork', adversarial: false },
          channel: 'mempool',
          url: SEND_RPC,
        },
        ...(evil
          ? [
              {
                ref: { id: 'evil-rpc', label: evil.label, adversarial: true },
                channel: 'mempool' as const,
                url: evil.url,
              },
            ]
          : []),
        {
          ref: {
            id: 'sim-censor',
            label: 'censoring builder (simulated)',
            adversarial: true,
          },
          channel: 'builder',
          url: '',
          blackhole: true,
        },
      ];

      const flight = await multicast({
        raw,
        txHash,
        from: account.address,
        routes,
      });
      setRecord(flight);
    } catch (err) {
      setSendError(
        `Could not broadcast: ${err instanceof Error ? err.message : String(err)}. The fork must be running — start it with \`pnpm fork\`.`,
      );
    } finally {
      setSending(false);
    }
  }, []);

  // ---- acts -------------------------------------------------------------

  const runAct = useCallback(
    async (id: ActId) => {
      setAct(id);
      if (id === 'lie') {
        // Re-read so the walk redraws live rather than replaying a cached result,
        // then show the forged proof — the broken path is the argument.
        setShowRejected(false);
        await readAll();
        setShowRejected(true);
      } else if (id === 'route') {
        setRadarLoading(true);
        const obs = await observeRelays({ limit: 200 });
        setObservations(obs);
        setRadarLoading(false);
        await send();
      }
    },
    [readAll, send],
  );

  // ---- derived ----------------------------------------------------------

  const activeReading: AccountReading | null =
    entries.find((e) => e.address === selected)?.reading ?? null;
  const rejected = activeReading?.provenance.rejected.find((r) => r.walk) ?? null;
  const showingBroken = showRejected && rejected?.walk != null;
  const shownWalk = showingBroken ? rejected!.walk : (activeReading?.walk ?? null);
  const verdict = showingBroken ? 'REJECTED' : (activeReading?.trust ?? 'UNVERIFIABLE');
  const filtered = filteredShare(observations);
  const bounds = boundaries(anchor, MODE);
  const currentAct = ACTS.find((a) => a.id === act) ?? null;

  return (
    <>
      <TrieGround />

      <div className="console">
        <header className="masthead">
          <h1 className="wordmark">NULLIUS</h1>
          <p className="motto">nullius in verba — take nobody&rsquo;s word for it</p>
          <div className="masthead__anchor">
            {anchor ? (
              <>
                <span>
                  root <strong className="mono">{anchor.stateRoot.slice(0, 10)}…</strong>
                </span>
                <span>
                  block{' '}
                  <strong className="mono">{anchor.blockNumber.toString()}</strong>
                </span>
                <span>
                  {anchor.corroborations} corroboration
                  {anchor.corroborations === 1 ? '' : 's'}
                </span>
              </>
            ) : (
              <span>no root — nothing is being checked</span>
            )}
          </div>
        </header>

        <div className="admitted">
          <Admitted boundaries={bounds} />
          {currentAct && (
            <p className="act-claim">
              <strong>
                {currentAct.numeral} · {currentAct.title}
              </strong>
              {currentAct.claim}
            </p>
          )}
        </div>

        <div className="stage">
          <section className="region region--plate region--register">
            <div className="region__head">
              <h2 className="region__title">Register</h2>
              <p className="region__note">
                {currentAct ? currentAct.title : 'every value carries its evidence'}
              </p>
            </div>
            <div className="region__body">
              {readError && (
                <p
                  className="provenance"
                  style={{ color: 'var(--vermilion-dim)', maxWidth: '58ch' }}
                >
                  {readError}
                </p>
              )}
              <Register
                entries={entries}
                selected={selected}
                onSelect={setSelected}
                showingBroken={showingBroken}
                shownWalk={shownWalk}
              />
            </div>
          </section>

          <section
            className="region region--field region--walk"
            data-verdict={verdict}
            key={`walk-${walkNonce.current}-${selected ?? 'none'}-${showingBroken ? 'broken' : 'closed'}`}
          >
            <div className="region__head">
              <h2 className="region__title">The walk</h2>
              <p className="region__note">
                {shownWalk
                  ? `${shownWalk.steps.length} nodes · ${showingBroken ? rejected!.provider.label : 'root to leaf'}`
                  : 'state root to account leaf'}
              </p>
              {rejected?.walk && (
                <button
                  className="action"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => setShowRejected((v) => !v)}
                >
                  {showingBroken ? 'Show the proof that closed' : 'Show the rejected proof'}
                </button>
              )}
            </div>
            <div className="region__body">
              <Walk walk={shownWalk} verdict={verdict} animate />
            </div>
          </section>

          <section className="region region--plate region--radar">
            <div className="region__head">
              <h2 className="region__title">Radar</h2>
              <p className="region__note">relay data, counted not inferred</p>
            </div>
            <div className="region__body">
              <Radar
                observations={observations}
                loading={radarLoading}
                filtered={filtered}
              />
            </div>
          </section>

          <section className="region region--void region--lower">
            <div className="lower">
              <Recorder
                record={record}
                sending={sending}
                onSend={send}
                error={sendError}
              />
              <Quorum
                readings={entries.map((e) => ({ label: e.label, reading: e.reading }))}
                gateWei={GATE_WEI}
              />
            </div>
          </section>
        </div>

        <ActRail
          acts={ACTS}
          current={act}
          onSelect={(id) => void runAct(id)}
          busy={busy || sending}
        />
      </div>
    </>
  );
}
