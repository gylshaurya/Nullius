/**
 * @nullius/types — FROZEN INTERFACE CONTRACT
 *
 * Every module codes against this file and nothing else. Changing a type here
 * is a cross-workstream event: announce it, do not do it quietly.
 *
 * The organising idea: no value crosses a module boundary without carrying how
 * it came to be believed. There is no bare `bigint` balance anywhere in this
 * system — only a `Reading<bigint>` that knows whether it was proven.
 */

export type Hex = `0x${string}`;
export type Address = `0x${string}`;

// ---------------------------------------------------------------------------
// Trust
// ---------------------------------------------------------------------------

/**
 * The four evidence classes. This is the product's spine, not a UI enum.
 *
 * PROVEN        Merkle-verified against a state root we independently trust.
 *               True as arithmetic. The only class allowed to be shown plainly.
 * ATTESTED      N independent providers agreed. Agreement, not proof.
 * UNVERIFIABLE  One source, no proof obtainable. A claim, and labelled as one.
 * REJECTED      A proof was offered and it failed. Someone lied, and we know it.
 */
export type TrustLevel = 'PROVEN' | 'ATTESTED' | 'UNVERIFIABLE' | 'REJECTED';

/** Ordering for display precedence and for "worst level in this group" rollups. */
export const TRUST_RANK: Record<TrustLevel, number> = {
  PROVEN: 3,
  ATTESTED: 2,
  UNVERIFIABLE: 1,
  REJECTED: 0,
};

/** The names PRODUCT.md uses. One vocabulary, every surface. */
export const TRUST_LABEL: Record<TrustLevel, string> = {
  PROVEN: 'Proven',
  ATTESTED: 'Attested',
  UNVERIFIABLE: 'Unverifiable',
  REJECTED: 'Rejected',
};

/**
 * What each class actually means, in the product's own plain language. Used
 * verbatim in the interface; kept here so every surface says the same thing.
 */
export const TRUST_RUBRIC: Record<TrustLevel, string> = {
  PROVEN: 'Merkle-verified against the anchored state root',
  ATTESTED: 'endpoints agree, no proof offered',
  UNVERIFIABLE: 'no proof obtainable for this value',
  REJECTED: 'the hash chain does not reach the root',
};

// ---------------------------------------------------------------------------
// Proof path — the raw material the figure plates are engraved from
// ---------------------------------------------------------------------------

export type TrieNodeKind = 'branch' | 'extension' | 'leaf';

/** One node on the walk from state root down to the account or storage leaf. */
export interface ProofStep {
  /** Depth from the root, 0-indexed. */
  index: number;
  kind: TrieNodeKind;
  /** keccak256 of this node's RLP encoding — its identity in the parent. */
  hash: Hex;
  /** Bytes of the RLP node, kept so the plate can render real microtext. */
  rlpLength: number;
  /** How many path nibbles this node consumed. */
  nibblesConsumed: number;
  /** For branches: which of the 16 slots the walk descended into. */
  branchSlot: number | null;
  /** Did this node's hash match the reference held by its parent? */
  matchesParent: boolean;
}

/** The complete verification attempt. Present even when it failed. */
export interface ProofWalk {
  /** Root the walk was checked against. */
  stateRoot: Hex;
  /** keccak256(address) — the path the walk must spell out. */
  pathKey: Hex;
  steps: ProofStep[];
  /** Index of the first step that broke, or null when the walk closed. */
  brokeAt: number | null;
  ok: boolean;
  /** Milliseconds spent verifying locally. */
  verifyMs: number;
}

// ---------------------------------------------------------------------------
// Provenance and Reading
// ---------------------------------------------------------------------------

export interface ProviderRef {
  /** Short stable id, e.g. "fork", "evil-rpc", "llamanodes". */
  id: string;
  /** Human label for the register. */
  label: string;
  /** True when this endpoint is a deliberate liar in the demo. */
  adversarial: boolean;
}

export interface Provenance {
  provider: ProviderRef;
  /** The RPC method actually issued — often eth_getProof, not what was asked. */
  method: string;
  /** The method the caller asked for. */
  requestedMethod: string;
  latencyMs: number;
  blockNumber: bigint | null;
  /** Providers that returned an identical value; only meaningful for ATTESTED. */
  attestedBy: ProviderRef[];
  /**
   * Providers whose answer failed verification during this read. The failed
   * walk is retained, not just its reason: the broken path is the most
   * interesting object in the system and the interface has to be able to draw
   * it. (Additive change to the frozen contract, announced.)
   */
  rejected: Array<{ provider: ProviderRef; reason: string; walk: ProofWalk | null }>;
  /** Set when this reading was ever anchored to a light-client root. */
  anchor: AnchorRef | null;
  observedAt: number;
}

/**
 * Where the state root came from. `simulated` is the honest label for the
 * Anvil-fork demo mode, where a real sync committee cannot be run.
 */
export interface AnchorRef {
  kind: 'light-client' | 'pinned-checkpoint' | 'simulated-fork';
  stateRoot: Hex;
  blockNumber: bigint;
  /** For light-client: the slot whose sync-committee signature we verified. */
  slot: bigint | null;
  /** Independent sources that agreed on this root, for pinned-checkpoint mode. */
  corroborations: number;
  /** One sentence stating exactly what is trusted here. Never empty. */
  assumption: string;
}

/** Nothing in this system returns a bare value. This is the return type. */
export interface Reading<T> {
  value: T | null;
  trust: TrustLevel;
  provenance: Provenance;
  /** Present whenever a proof was attempted, successful or not. */
  walk: ProofWalk | null;
  /** Why this is not PROVEN. Required for every non-PROVEN reading. */
  caveat: string | null;
}

export type AccountReading = Reading<AccountState>;

export interface AccountState {
  address: Address;
  balance: bigint;
  nonce: bigint;
  codeHash: Hex;
  storageRoot: Hex;
}

// ---------------------------------------------------------------------------
// Route — censorship radar and the flight recorder
// ---------------------------------------------------------------------------

/** Public posture of a relay with respect to transaction filtering. */
export type FilterPosture = 'filtering' | 'unfiltered' | 'unknown';

export interface RelayRef {
  id: string;
  label: string;
  /** Base URL of the relay data API. */
  dataApi: string;
  posture: FilterPosture;
}

/**
 * A measurement, never an inference. Every field here is counted from public
 * relay data or from chain; nothing describes intent.
 */
export interface RelayObservation {
  relay: RelayRef;
  windowSlots: number;
  payloadsDelivered: number;
  /** Share of delivered payloads in the window across observed relays. */
  share: number;
  /** Distinct builder pubkeys seen delivering through this relay. */
  builders: number;
  lastSeenSlot: bigint | null;
  /** Null when the window held too few samples to say anything. */
  medianDelaySlots: number | null;
  /**
   * Whether this row was measured now or read from a stored snapshot. A static
   * deployment cannot reach the relay APIs (they send no CORS headers and there
   * is no proxy), so it falls back to a snapshot. The interface must say which,
   * because presenting stored numbers as live ones would be the exact kind of
   * unlabelled claim this project exists to refuse.
   */
  source: 'live' | 'snapshot';
  /** Set when the data API failed; the row still renders, as unattested. */
  error: string | null;
  observedAt: number;
}

export type RouteStatus = 'submitted' | 'acknowledged' | 'silent' | 'refused';

export interface RouteReceipt {
  route: RelayRef | ProviderRef;
  /** 'relay' | 'builder' | 'mempool' — how this route reaches the chain. */
  channel: 'relay' | 'builder' | 'mempool';
  submittedAt: number;
  acknowledgedAt: number | null;
  /** Verbatim response body, when the route gave one. */
  response: string | null;
  status: RouteStatus;
  error: string | null;
}

export interface InclusionProof {
  /** transactionsRoot from the block header. */
  transactionsRoot: Hex;
  /** Index of the transaction within the block. */
  txIndex: number;
  walk: ProofWalk;
  /** Anchor for the header the root was read from. */
  anchor: AnchorRef | null;
}

/** The per-transaction record. Every send produces one, including failures. */
export interface FlightRecord {
  txHash: Hex;
  from: Address;
  submittedAt: number;
  receipts: RouteReceipt[];
  includedInBlock: bigint | null;
  includedAt: number | null;
  /** Blocks between first submission and inclusion. The censorship signal. */
  blocksElapsed: number | null;
  inclusion: InclusionProof | null;
  trust: TrustLevel;
}

// ---------------------------------------------------------------------------
// Id — zero-knowledge proof of holdings
// ---------------------------------------------------------------------------

/**
 * Which construction actually produced a proof. Plan A proves the real state
 * trie inside the circuit; Plan B proves membership of a published snapshot.
 * The interface must always state which one is running.
 */
export type HoldingScheme = 'mpt-in-circuit' | 'poseidon-snapshot';

export interface HoldingClaim {
  scheme: HoldingScheme;
  /** Threshold proven, in wei. The exact balance is never revealed. */
  thresholdWei: bigint;
  /** Block the claim is anchored to. */
  blockNumber: bigint;
  /** State root (Plan A) or published snapshot root (Plan B). */
  root: Hex;
  /** One-way tag preventing reuse in this context. */
  nullifier: Hex;
  /** Domain separator, so the same account is unlinkable across contexts. */
  context: string;
  proof: Hex;
  provingMs: number;
  /** For Plan B: the assumption the snapshot introduces. Null for Plan A. */
  snapshotCaveat: string | null;
}

export type HoldingVerdict =
  | { ok: true; claim: HoldingClaim }
  | { ok: false; reason: string; claim: HoldingClaim | null };

// ---------------------------------------------------------------------------
// Quorum — anonymous signalling
// ---------------------------------------------------------------------------

export interface QuorumGroup {
  id: string;
  /** Human question or motion being signalled on. */
  motion: string;
  /** Semaphore merkle root of identity commitments. */
  merkleRoot: Hex;
  members: number;
  /** Holding threshold required to join, in wei. */
  gateWei: bigint;
  /** RLN message quota per member per epoch. */
  quota: number;
}

export interface Signal {
  groupId: string;
  /** The signal itself — kept coarse on purpose. */
  choice: 'for' | 'against' | 'abstain';
  /** Per-topic nullifier. Prevents double-signalling, reveals nothing. */
  nullifier: Hex;
  proof: Hex;
  at: number;
}

export interface QuorumTally {
  group: QuorumGroup;
  for: number;
  against: number;
  abstain: number;
  /**
   * Honesty field. This system provides anonymity, not receipt-freeness, so
   * it is not collusion-resistant. Always populated, always surfaced.
   */
  collusionCaveat: string;
}

// ---------------------------------------------------------------------------
// The demo rail — three acts driving the real panels
// ---------------------------------------------------------------------------

export type ActId = 'lie' | 'route' | 'quorum';

export interface Act {
  id: ActId;
  /** Roman numeral as printed on the rail. */
  numeral: string;
  title: string;
  /** One line stating what the act demonstrates. */
  claim: string;
  /** Which panels this act drives, in order. */
  drives: PanelId[];
}

export type PanelId = 'register' | 'plate' | 'radar' | 'recorder' | 'quorum';

// ---------------------------------------------------------------------------
// Cross-cutting
// ---------------------------------------------------------------------------

/** What the whole system is prepared to admit it does not prove. */
export interface TrustBoundary {
  id: string;
  claim: string;
  /** Exactly what is assumed, in one plain sentence. */
  assumption: string;
  /** Whether this is currently load-bearing in the running configuration. */
  active: boolean;
}

export interface SystemStatus {
  anchor: AnchorRef | null;
  providers: Array<{ provider: ProviderRef; reachable: boolean; servesProofs: boolean }>;
  boundaries: TrustBoundary[];
  /** Set when the running configuration is the fork demo, not live mainnet. */
  mode: 'fork-demo' | 'live-mainnet';
}
