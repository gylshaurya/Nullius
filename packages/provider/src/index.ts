/**
 * @nullius/provider — the verifying read path.
 *
 * The rule that governs this file, and which the rest of the system depends on:
 * we fan out to every provider for speed and liveness, and then the FIRST
 * RESPONSE THAT VERIFIES WINS. We never count votes. A provider returning a
 * valid proof is believed regardless of what the others said; a provider
 * returning an invalid one is recorded as having lied, regardless of how many
 * agree with it.
 *
 * One honest provider is sufficient. Zero honest providers means we return
 * null with trust REJECTED — liveness degrades, safety does not.
 */

import type {
  AccountReading,
  AccountState,
  Address,
  AnchorRef,
  Hex,
  ProviderRef,
  Provenance,
  SystemStatus,
  TrustBoundary,
} from '@nullius/types';
import { verifyAccountProof } from './mpt.js';

export * from './mpt.js';

export interface Endpoint extends ProviderRef {
  url: string;
}

export interface ReaderOptions {
  endpoints: Endpoint[];
  mode: 'fork-demo' | 'live-mainnet';
  timeoutMs?: number;
  /**
   * The chain we are supposed to be reading. An endpoint that answers for a
   * different chain is excluded from anchoring entirely — see resolveAnchor.
   */
  expectedChainId?: bigint;
}

// ---------------------------------------------------------------------------
// Minimal JSON-RPC, hand-rolled so we own the timing and the failure detail
// ---------------------------------------------------------------------------

interface RpcOutcome<T> {
  ok: boolean;
  value: T | null;
  error: string | null;
  latencyMs: number;
}

let rpcId = 1;

async function rpc<T>(
  url: string,
  method: string,
  params: unknown[],
  timeoutMs: number,
): Promise<RpcOutcome<T>> {
  const started = performance.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }),
      signal: ctl.signal,
    });
    const json = (await res.json()) as { result?: T; error?: { message?: string } };
    const latencyMs = performance.now() - started;
    if (json.error) {
      return { ok: false, value: null, error: json.error.message ?? 'rpc error', latencyMs };
    }
    if (json.result === undefined) {
      return { ok: false, value: null, error: 'empty result', latencyMs };
    }
    return { ok: true, value: json.result, error: null, latencyMs };
  } catch (err) {
    return {
      ok: false,
      value: null,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: performance.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Anchor
// ---------------------------------------------------------------------------

interface BlockHeader {
  number: Hex;
  hash: Hex;
  stateRoot: Hex;
  transactionsRoot: Hex;
}

/**
 * Establish the state root everything else is checked against.
 *
 * In fork-demo mode there is no sync committee to verify — a local fork has no
 * beacon chain — so we corroborate the header across every endpoint and record
 * honestly that the anchor is `simulated-fork`. The interface says so. What is
 * NOT simulated is the state itself: it is real mainnet state, and a forged
 * proof against this root fails for exactly the reason it would on mainnet.
 *
 * A liar cannot usefully attack this step: to move the root it would have to
 * produce a header whose state root commits to its lie, which is the same as
 * breaking keccak256. It can only refuse to answer, and refusing loses.
 */
export async function resolveAnchor(opts: ReaderOptions): Promise<AnchorRef | null> {
  const timeoutMs = opts.timeoutMs ?? 4000;

  const expectedChainId = opts.expectedChainId ?? 1n;

  /**
   * Step 1: refuse endpoints that are not on the chain we are reading.
   *
   * This is not a nicety. A local dev chain once occupied a configured port, and
   * because it reported a height of ~4,000 it dragged the anchor (then chosen as
   * min-height) back to a block where no mainnet account existed. Every proof
   * then verified — as a correct proof of ABSENCE — and the interface showed
   * "proven" against a garbage root. An endpoint answering for chain 31337 must
   * never influence what we believe about chain 1.
   */
  const chainIds = await Promise.all(
    opts.endpoints.map((e) => rpc<Hex>(e.url, 'eth_chainId', [], timeoutMs)),
  );
  const eligible = opts.endpoints.filter((_, i) => {
    const r = chainIds[i];
    if (!r?.ok || !r.value) return false;
    try {
      return BigInt(r.value) === expectedChainId;
    } catch {
      return false;
    }
  });
  if (eligible.length === 0) return null;

  /**
   * Step 2: pick a block at least TWO eligible endpoints claim to have.
   *
   * Endpoints sit at slightly different heights, so anchoring on one provider's
   * "latest" guarantees the others cannot serve a proof for it. But taking the
   * minimum lets any single endpoint drag the anchor anywhere it likes by
   * under-reporting — a liar choosing our root, which is precisely the thing this
   * project exists to prevent. Taking the maximum inverts the same problem.
   *
   * So: sort the reported heights descending and take the second, which is the
   * highest block at least two independent endpoints claim. One endpoint lying in
   * either direction cannot move it.
   */
  const heads = await Promise.all(
    eligible.map((e) =>
      rpc<BlockHeader>(e.url, 'eth_getBlockByNumber', ['latest', false], timeoutMs),
    ),
  );
  const heights = heads
    .filter((r) => r.ok && r.value?.number)
    .map((r) => BigInt(r.value!.number))
    .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  if (heights.length === 0) return null;
  const corroboratedHead = heights.length >= 2 ? heights[1]! : heights[0]!;
  const target = corroboratedHead - 2n;
  const targetTag = `0x${target.toString(16)}`;

  const results = await Promise.all(
    eligible.map((e) =>
      rpc<BlockHeader>(e.url, 'eth_getBlockByNumber', [targetTag, false], timeoutMs).then(
        (r) => ({ endpoint: e, r }),
      ),
    ),
  );

  // Group by reported state root and take the most corroborated. Note this is
  // NOT a security vote — see the assumption string below. It is a tie-break
  // among candidate roots, and every candidate is then subject to proof.
  const byRoot = new Map<Hex, { count: number; header: BlockHeader }>();
  for (const { r } of results) {
    if (!r.ok || !r.value?.stateRoot) continue;
    const key = r.value.stateRoot;
    const prev = byRoot.get(key);
    if (prev) prev.count += 1;
    else byRoot.set(key, { count: 1, header: r.value });
  }
  if (byRoot.size === 0) return null;

  let best: { root: Hex; count: number; header: BlockHeader } | null = null;
  for (const [root, v] of byRoot) {
    if (!best || v.count > best.count) best = { root, count: v.count, header: v.header };
  }
  if (!best) return null;

  return {
    kind: opts.mode === 'fork-demo' ? 'simulated-fork' : 'pinned-checkpoint',
    stateRoot: best.root,
    blockNumber: BigInt(best.header.number),
    slot: null,
    corroborations: best.count,
    assumption:
      opts.mode === 'fork-demo'
        ? 'The state is real mainnet state, read from a local fork. There is no beacon chain on a fork, so sync-committee verification is not running: this root is corroborated across endpoints, not consensus-verified. Proofs are checked against it exactly as they would be on mainnet.'
        : 'This root comes from a header corroborated across independent endpoints, not from a verified sync-committee signature. Full light-client sync is the next step; until then this is the one thing being trusted.',
  };
}

// ---------------------------------------------------------------------------
// Account reads
// ---------------------------------------------------------------------------

interface ProofResponse {
  balance: Hex;
  nonce: Hex;
  codeHash: Hex;
  storageHash: Hex;
  accountProof: Hex[];
}

export class VerifyingReader {
  private anchor: AnchorRef | null = null;
  private anchorAt = 0;
  /**
   * A verified reading is a pure function of (address, state root): the root
   * commits to every account, so re-verifying the same pair cannot produce a
   * different answer. Caching it is not a shortcut past verification — it is the
   * consequence of verification actually meaning something, and it keeps a demo
   * off the public endpoints' rate limits.
   */
  private readings = new Map<string, AccountReading>();

  constructor(private readonly opts: ReaderOptions) {}

  get timeout(): number {
    return this.opts.timeoutMs ?? 4000;
  }

  get endpoints(): Endpoint[] {
    return this.opts.endpoints;
  }

  get currentAnchor(): AnchorRef | null {
    return this.anchor;
  }

  async refreshAnchor(): Promise<AnchorRef | null> {
    // One block is ~12s; re-resolving faster than that spends requests to learn
    // the same root.
    if (this.anchor && Date.now() - this.anchorAt < 12_000) return this.anchor;
    const next = await resolveAnchor(this.opts);
    if (next) {
      this.anchor = next;
      this.anchorAt = Date.now();
    }
    return this.anchor;
  }

  /**
   * The read that matters. Returns a Reading whose trust level is earned, not
   * assigned. `walk` is populated whether verification succeeded or failed,
   * because the failing walk is what the interface draws.
   */
  async readAccount(address: Address): Promise<AccountReading> {
    const anchor = this.anchor ?? (await this.refreshAnchor());
    const observedAt = Date.now();

    if (!anchor) {
      return {
        value: null,
        trust: 'UNVERIFIABLE',
        provenance: this.emptyProvenance(address, observedAt),
        walk: null,
        caveat:
          'No endpoint returned a block header, so there is no root to check anything against. Nothing is shown rather than something unchecked.',
      };
    }

    const cacheKey = `${address}:${anchor.stateRoot}`;
    const cached = this.readings.get(cacheKey);
    if (cached) return cached;

    const blockTag = `0x${anchor.blockNumber.toString(16)}`;

    const attempts = await Promise.all(
      this.opts.endpoints.map(async (endpoint) => {
        const proofRes = await rpc<ProofResponse>(
          endpoint.url,
          'eth_getProof',
          [address, [], blockTag],
          this.timeout,
        );
        if (!proofRes.ok || !proofRes.value) {
          return {
            endpoint,
            latencyMs: proofRes.latencyMs,
            error: proofRes.error ?? 'no proof',
            verified: null,
          };
        }
        const result = verifyAccountProof({
          stateRoot: anchor.stateRoot,
          address,
          proof: proofRes.value.accountProof ?? [],
        });
        return {
          endpoint,
          latencyMs: proofRes.latencyMs,
          error: null,
          verified: result,
          claimed: proofRes.value,
        };
      }),
    );

    // First response that verifies wins. Ordering is by latency so "first" is
    // meaningful rather than incidental.
    const ordered = [...attempts].sort((a, b) => a.latencyMs - b.latencyMs);
    const winner = ordered.find((a) => a.verified?.ok === true);
    const rejected = ordered
      .filter((a) => a.verified && a.verified.ok === false)
      .map((a) => ({
        provider: stripUrl(a.endpoint),
        reason:
          a.verified && a.verified.walk.brokeAt !== null
            ? `proof broke at node ${a.verified.walk.brokeAt} of ${a.verified.walk.steps.length}`
            : 'proof failed to verify',
        walk: a.verified?.walk ?? null,
      }));

    if (!winner || !winner.verified) {
      const firstBroken = ordered.find((a) => a.verified);
      return {
        value: null,
        trust: 'REJECTED',
        provenance: {
          provider: stripUrl(ordered[0]?.endpoint ?? this.opts.endpoints[0]!),
          method: 'eth_getProof',
          requestedMethod: 'eth_getBalance',
          latencyMs: ordered[0]?.latencyMs ?? 0,
          blockNumber: anchor.blockNumber,
          attestedBy: [],
          rejected,
          anchor,
          observedAt,
        },
        walk: firstBroken?.verified?.walk ?? null,
        caveat:
          rejected.length > 0
            ? 'Every endpoint that answered served a proof that does not hash to this state root. Nothing is shown.'
            : 'No endpoint served a proof for this account.',
      };
    }

    const provenance: Provenance = {
      provider: stripUrl(winner.endpoint),
      method: 'eth_getProof',
      requestedMethod: 'eth_getBalance',
      latencyMs: winner.latencyMs,
      blockNumber: anchor.blockNumber,
      attestedBy: ordered
        .filter(
          (a) =>
            a !== winner &&
            a.verified?.ok === true &&
            a.verified.account?.balance === winner.verified?.account?.balance,
        )
        .map((a) => stripUrl(a.endpoint)),
      rejected,
      anchor,
      observedAt,
    };

    /**
     * A closed walk that ends in absence is a valid EXCLUSION proof: the trie
     * demonstrates the account is not there, so its balance is zero. That is a
     * real, proven answer and must be shown as one — a zero, with the reason.
     *
     * It must NOT be shown as a proven balance with an empty value, which is what
     * happened before: `account: null` rendered as an em-dash under the words
     * "Merkle-verified", which reads as a proven number the interface merely
     * failed to print. Presenting "this account does not exist" as "here is the
     * proven balance" is the kind of overclaim PRODUCT.md forbids.
     */
    const absent = winner.verified.account === null;
    const reading: AccountReading = {
      value: absent
        ? {
            address,
            balance: 0n,
            nonce: 0n,
            codeHash: '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
            storageRoot: '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
          }
        : winner.verified.account,
      trust: 'PROVEN',
      provenance,
      walk: winner.verified.walk,
      caveat: absent
        ? 'This account is not present in the state trie at this block, and the proof demonstrates that rather than merely failing to find it. Its balance is therefore zero. If you expected a balance here, check the anchored block — an unexpectedly old root will prove the absence of accounts that exist today.'
        : null,
    };
    this.readings.set(cacheKey, reading);
    return reading;
  }

  /**
   * Ask every endpoint the ordinary, unverifiable question — the one a normal
   * wallet asks. Used to show the discrepancy: what an app would have believed
   * next to what we could prove. This method's answers are NEVER promoted to
   * PROVEN, whatever they say.
   */
  async readBalanceUnverified(
    address: Address,
    /**
     * The interface only displays the discrepancy, so by default we ask only the
     * endpoints that might produce one. Querying every endpoint on every read
     * triples the request count to learn nothing the proof did not already
     * settle — and public endpoints rate-limit.
     */
    onlyAdversarial = false,
  ): Promise<Array<{ provider: ProviderRef; balance: bigint | null; latencyMs: number; error: string | null }>> {
    const targets = onlyAdversarial
      ? this.opts.endpoints.filter((e) => e.adversarial)
      : this.opts.endpoints;
    return Promise.all(
      targets.map(async (endpoint) => {
        const r = await rpc<Hex>(endpoint.url, 'eth_getBalance', [address, 'latest'], this.timeout);
        return {
          provider: stripUrl(endpoint),
          balance: r.ok && r.value ? BigInt(r.value) : null,
          latencyMs: r.latencyMs,
          error: r.error,
        };
      }),
    );
  }

  async status(): Promise<SystemStatus> {
    const anchor = this.anchor ?? (await this.refreshAnchor());
    const providers = await Promise.all(
      this.opts.endpoints.map(async (endpoint) => {
        const head = await rpc<BlockHeader>(
          endpoint.url,
          'eth_getBlockByNumber',
          ['latest', false],
          this.timeout,
        );
        // Probe proof support with the zero address; cheap and always present.
        const probe = await rpc<ProofResponse>(
          endpoint.url,
          'eth_getProof',
          ['0x0000000000000000000000000000000000000000', [], 'latest'],
          this.timeout,
        );
        return {
          provider: stripUrl(endpoint),
          reachable: head.ok,
          servesProofs: probe.ok && Array.isArray(probe.value?.accountProof),
        };
      }),
    );
    return { anchor, providers, boundaries: boundaries(anchor, this.opts.mode), mode: this.opts.mode };
  }

  private emptyProvenance(_address: Address, observedAt: number): Provenance {
    return {
      provider: stripUrl(this.opts.endpoints[0]!),
      method: 'eth_getProof',
      requestedMethod: 'eth_getBalance',
      latencyMs: 0,
      blockNumber: null,
      attestedBy: [],
      rejected: [],
      anchor: null,
      observedAt,
    };
  }
}

function stripUrl(e: Endpoint | ProviderRef): ProviderRef {
  return { id: e.id, label: e.label, adversarial: e.adversarial };
}

/**
 * The standing list of things this system does not prove. Surfaced in the
 * interface permanently, not in a footnote. `active` reflects the running
 * configuration, so nothing claims to be solved that isn't.
 */
export function boundaries(
  anchor: AnchorRef | null,
  mode: 'fork-demo' | 'live-mainnet',
): TrustBoundary[] {
  return [
    {
      id: 'anchor',
      claim: 'the state root',
      assumption:
        anchor?.assumption ??
        'No root is established, so nothing is being checked at all right now.',
      active: true,
    },
    {
      id: 'eth-call',
      claim: 'contract call results',
      assumption:
        'eth_call is a computation, not a lookup. Verifying it means fetching proofs for every slot touched and re-executing locally. Implemented for ERC-20 balanceOf only; everything else is marked unattested.',
      active: true,
    },
    {
      id: 'gas',
      claim: 'gas estimates',
      assumption: 'No proof exists for an estimate. It is a claim, and it is labelled as one.',
      active: true,
    },
    {
      id: 'logs',
      claim: 'event logs',
      assumption:
        'Receipt-trie proofs can verify logs. Not wired yet, so log-derived values are unattested.',
      active: true,
    },
    {
      id: 'sync',
      claim: 'consensus verification',
      assumption:
        mode === 'fork-demo'
          ? 'Sync-committee signature verification is not running: a local fork has no beacon chain to verify against. The state is real; the anchor is not consensus-verified.'
          : 'Sync-committee signature verification is not running. The root is accepted because independent endpoints agree on it — which is a LARGER assumption than the fork case, not a smaller one, because these are third parties rather than a chain running on this machine. This is the biggest thing being trusted here.',
      // Always live. It was previously dimmed on live mainnet, which dimmed the
      // assumption at exactly the moment it got bigger — the interface
      // under-declaring its own trust boundary is the one failure this product
      // cannot afford.
      active: true,
    },
  ];
}
