/**
 * @nullius/route — censorship radar and the flight recorder.
 *
 * Everything here is a measurement. Relays publish what they delivered; we
 * count it. Nothing in this file describes intent, and nothing infers motive
 * from behaviour — "this relay has not included this kind of transaction" is a
 * fact, "this relay is censoring you" is an inference, and we ship the fact.
 *
 * Browsers cannot reach relay data APIs directly (no CORS), so in development
 * these paths are proxied by Vite. The proxy is a transport detail, not a trust
 * boundary: relay data is self-reported by relays either way, which is exactly
 * why it is labelled ATTESTED and never PROVEN.
 */

import type { FlightRecord, RelayObservation, RelayRef, RouteReceipt } from '@nullius/types';

/**
 * The relays that actually carry mainnet blocks. `posture` records each one's
 * publicly stated filtering position — a documented fact about the operator,
 * not something we measured.
 */
export const RELAYS: RelayRef[] = [
  {
    id: 'flashbots',
    label: 'Flashbots',
    dataApi: '/relay/flashbots',
    posture: 'filtering',
  },
  {
    id: 'bloxroute-regulated',
    label: 'bloXroute Regulated',
    dataApi: '/relay/bloxroute-regulated',
    posture: 'filtering',
  },
  {
    id: 'bloxroute-max-profit',
    label: 'bloXroute Max Profit',
    dataApi: '/relay/bloxroute-max-profit',
    posture: 'unfiltered',
  },
  {
    id: 'agnostic',
    label: 'Agnostic Gnosis',
    dataApi: '/relay/agnostic',
    posture: 'unfiltered',
  },
  {
    id: 'ultrasound',
    label: 'Ultra Sound',
    dataApi: '/relay/ultrasound',
    posture: 'unfiltered',
  },
  {
    id: 'aestus',
    label: 'Aestus',
    dataApi: '/relay/aestus',
    posture: 'unfiltered',
  },
  {
    id: 'titan',
    label: 'Titan',
    dataApi: '/relay/titan',
    posture: 'unknown',
  },
];

/** One row of a relay's `proposer_payload_delivered` feed. */
interface BidTrace {
  slot: string;
  block_number: string;
  block_hash: string;
  builder_pubkey: string;
  num_tx: string;
  value: string;
}

const DELIVERED = '/relay/v1/data/bidtraces/proposer_payload_delivered';

async function fetchDelivered(
  relay: RelayRef,
  limit: number,
  timeoutMs: number,
): Promise<{ rows: BidTrace[] | null; error: string | null }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${relay.dataApi}${DELIVERED}?limit=${limit}`, {
      signal: ctl.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return { rows: null, error: `HTTP ${res.status}` };
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) return { rows: null, error: 'unexpected payload shape' };
    return { rows: json as BidTrace[], error: null };
  } catch (err) {
    return {
      rows: null,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface RadarOptions {
  /** Rows to pull per relay. Relays cap this; 200 is widely accepted. */
  limit?: number;
  timeoutMs?: number;
  relays?: RelayRef[];
}

/**
 * Observe every relay concurrently. A relay whose API fails still returns a
 * row, carrying its error — a blank space in a table reads as "nothing
 * happening", which is a different and false claim.
 */
export async function observeRelays(opts: RadarOptions = {}): Promise<RelayObservation[]> {
  const limit = opts.limit ?? 200;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const relays = opts.relays ?? RELAYS;
  const observedAt = Date.now();

  const raw = await Promise.all(
    relays.map(async (relay) => {
      const { rows, error } = await fetchDelivered(relay, limit, timeoutMs);
      return { relay, rows, error };
    }),
  );

  /**
   * Counting raw rows would be dishonest: every relay is asked for the same
   * `limit`, so every relay returns roughly `limit` rows and each one appears to
   * hold an identical share. That number would be an artifact of our own request
   * cap, not a measurement of Ethereum.
   *
   * So we compare over a window every relay can actually see: the intersection
   * of their returned slot ranges. Newest common slot down to the newest of the
   * relays' oldest slots. Inside that window each relay's coverage is complete,
   * so the counts are directly comparable and the share means something.
   */
  const ranges = raw
    .filter((r) => r.rows && r.rows.length > 0)
    .map(({ rows }) => {
      const slots = (rows as BidTrace[])
        .map((r) => Number(r.slot))
        .filter((n) => Number.isFinite(n));
      return { newest: Math.max(...slots), oldest: Math.min(...slots) };
    });

  const windowEnd = ranges.length > 0 ? Math.min(...ranges.map((r) => r.newest)) : 0;
  const windowStart = ranges.length > 0 ? Math.max(...ranges.map((r) => r.oldest)) : 0;
  const windowSlots = windowEnd >= windowStart ? windowEnd - windowStart + 1 : 0;

  const counted = raw.map(({ relay, rows, error }) => {
    if (!rows) return { relay, rows: null, error, inWindow: [] as BidTrace[] };
    const inWindow = rows.filter((r) => {
      const s = Number(r.slot);
      return Number.isFinite(s) && s >= windowStart && s <= windowEnd;
    });
    return { relay, rows, error, inWindow };
  });

  const totalInWindow = counted.reduce((sum, c) => sum + c.inWindow.length, 0);

  return counted.map(({ relay, rows, error, inWindow }): RelayObservation => {
    if (!rows) {
      return {
        relay,
        windowSlots: 0,
        payloadsDelivered: 0,
        share: 0,
        builders: 0,
        lastSeenSlot: null,
        medianDelaySlots: null,
        error,
        observedAt,
      };
    }
    const allSlots = rows
      .map((r) => Number(r.slot))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a);
    const newest = allSlots[0];
    return {
      relay,
      windowSlots,
      payloadsDelivered: inWindow.length,
      share: totalInWindow > 0 ? inWindow.length / totalInWindow : 0,
      builders: new Set(inWindow.map((r) => r.builder_pubkey)).size,
      lastSeenSlot: newest !== undefined ? BigInt(newest) : null,
      // Deliberately null: inclusion delay cannot be derived from this feed
      // alone, and a computed-looking number we cannot defend is worse than an
      // empty cell that says so.
      medianDelaySlots: null,
      error: null,
      observedAt,
    };
  });
}

/**
 * Share of delivered payloads flowing through relays that publicly filter.
 * The single number most worth putting in front of someone.
 */
export function filteredShare(observations: RelayObservation[]): number {
  const total = observations.reduce((s, o) => s + o.payloadsDelivered, 0);
  if (total === 0) return 0;
  const filtered = observations
    .filter((o) => o.relay.posture === 'filtering')
    .reduce((s, o) => s + o.payloadsDelivered, 0);
  return filtered / total;
}

// ---------------------------------------------------------------------------
// Flight recorder
// ---------------------------------------------------------------------------

export interface SendRoute {
  ref: RelayRef | { id: string; label: string; adversarial: boolean };
  channel: 'relay' | 'builder' | 'mempool';
  /** JSON-RPC endpoint that accepts eth_sendRawTransaction. */
  url: string;
  /**
   * When true this route silently accepts and never forwards — the local
   * censoring-builder simulator. Shipped so the mechanism is reproducible on
   * demand instead of depending on catching a real event during a demo.
   */
  blackhole?: boolean;
}

/**
 * Broadcast to every route at once and record what each one did. Routes are
 * not raced for a single winner: the whole point is the comparison.
 */
export async function multicast(args: {
  raw: `0x${string}`;
  txHash: `0x${string}`;
  from: `0x${string}`;
  routes: SendRoute[];
  timeoutMs?: number;
}): Promise<FlightRecord> {
  const timeoutMs = args.timeoutMs ?? 6000;
  const submittedAt = Date.now();

  const receipts = await Promise.all(
    args.routes.map(async (route): Promise<RouteReceipt> => {
      const base: RouteReceipt = {
        route: route.ref as RouteReceipt['route'],
        channel: route.channel,
        submittedAt: Date.now(),
        acknowledgedAt: null,
        response: null,
        status: 'submitted',
        error: null,
      };

      if (route.blackhole) {
        // Accepts, acknowledges nothing, forwards nothing. Exactly what silent
        // censorship looks like from the sender's side.
        return { ...base, status: 'silent', error: null };
      }

      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetch(route.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_sendRawTransaction',
            params: [args.raw],
          }),
          signal: ctl.signal,
        });
        const json = (await res.json()) as {
          result?: string;
          error?: { message?: string };
        };
        if (json.error) {
          return {
            ...base,
            status: 'refused',
            acknowledgedAt: Date.now(),
            response: JSON.stringify(json.error),
            error: json.error.message ?? 'refused',
          };
        }
        return {
          ...base,
          status: 'acknowledged',
          acknowledgedAt: Date.now(),
          response: json.result ?? null,
        };
      } catch (err) {
        return {
          ...base,
          status: 'silent',
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return {
    txHash: args.txHash,
    from: args.from,
    submittedAt,
    receipts,
    includedInBlock: null,
    includedAt: null,
    blocksElapsed: null,
    inclusion: null,
    // Relay acknowledgements are self-reported. Until we hold an inclusion
    // proof, this record is ATTESTED at best.
    trust: 'ATTESTED',
  };
}
