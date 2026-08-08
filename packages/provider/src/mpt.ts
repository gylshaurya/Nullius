/**
 * Merkle-Patricia Trie proof verification.
 *
 * This is the file the whole project rests on. Everything else is arrangement.
 *
 * An `eth_getProof` response (EIP-1186) hands us the list of RLP-encoded trie
 * nodes running from the state root down to one account's leaf. We are given
 * no reason to believe any of it. So we rebuild the claim from the bottom:
 *
 *   1. The path an account occupies in the trie is keccak256(address), read as
 *      64 four-bit nibbles. That is not a convention we can be talked out of.
 *   2. Every node's identity is keccak256 of its own RLP encoding, and each
 *      parent holds its children's identities. So we hash each node we are
 *      handed and check it against the reference its parent gave us.
 *   3. The walk must spell out exactly the nibble path from step 1 — no more,
 *      no less — and terminate in a leaf.
 *   4. The first node's hash must equal a state root we obtained independently.
 *
 * If all four hold, the account data is genuine in the same sense that 2+2=4.
 * If any fails, someone lied, and we know precisely where: `brokeAt`.
 *
 * We deliberately return the whole walk on failure as well as success. The
 * failing step is the most interesting object in the system — it is the thing
 * the interface draws when it catches a provider out.
 */

import { keccak256, fromRlp, toRlp, hexToBytes, size, isHex } from 'viem';
import type {
  Address,
  AccountState,
  Hex,
  ProofStep,
  ProofWalk,
  TrieNodeKind,
} from '@nullius/types';

/** A decoded RLP item: either a byte string or a list of items. */
type RlpItem = Hex | RlpItem[];

export class ProofError extends Error {
  constructor(
    message: string,
    readonly step: number,
  ) {
    super(message);
    this.name = 'ProofError';
  }
}

// ---------------------------------------------------------------------------
// Nibbles
// ---------------------------------------------------------------------------

/** Expand a hex string into one nibble (0-15) per element. */
export function toNibbles(hex: Hex): number[] {
  const bytes = hexToBytes(hex);
  const nibbles = new Array<number>(bytes.length * 2);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] as number;
    nibbles[i * 2] = b >> 4;
    nibbles[i * 2 + 1] = b & 0x0f;
  }
  return nibbles;
}

/**
 * Undo hex-prefix (compact) encoding, the scheme trie nodes use to store a
 * partial path in a byte string. The first nibble is a flag:
 *
 *   0  extension, even number of path nibbles
 *   1  extension, odd  (next nibble is already path)
 *   2  leaf,      even
 *   3  leaf,      odd
 */
export function decodeCompactPath(hex: Hex): { isLeaf: boolean; nibbles: number[] } {
  const all = toNibbles(hex);
  const flag = all[0];
  if (flag === undefined) throw new Error('empty compact path');
  const isLeaf = flag >= 2;
  const odd = flag % 2 === 1;
  return { isLeaf, nibbles: all.slice(odd ? 1 : 2) };
}

// ---------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------

/**
 * What a parent told us about a child. A child reference is normally the
 * child's 32-byte hash, but nodes whose RLP is shorter than 32 bytes are
 * embedded directly in the parent instead of being hashed — so the reference
 * is the node itself, and there is no separate entry for it in the proof list.
 */
type ChildRef = { kind: 'hash'; hash: Hex } | { kind: 'inline'; node: RlpItem[] };

function classify(node: RlpItem[]): TrieNodeKind {
  if (node.length === 17) return 'branch';
  if (node.length === 2) {
    const first = node[0];
    if (typeof first !== 'string') throw new Error('malformed short node');
    return decodeCompactPath(first).isLeaf ? 'leaf' : 'extension';
  }
  throw new Error(`unexpected trie node arity: ${node.length}`);
}

function refFromChild(child: RlpItem): ChildRef | null {
  if (Array.isArray(child)) return { kind: 'inline', node: child };
  // '0x' is the empty slot in a branch — the path ends here and the account
  // does not exist. That is a valid, provable answer, not a failure.
  if (child === '0x' || child === '0x00') return null;
  return { kind: 'hash', hash: child };
}

export interface AccountProofResult {
  walk: ProofWalk;
  /** Null when the proof correctly demonstrates the account does not exist. */
  account: AccountState | null;
  /** True when the walk closed — whether or not the account exists. */
  ok: boolean;
}

/**
 * Verify an account proof against a state root.
 *
 * Never throws for a bad proof: a lying provider is an expected input, not an
 * exceptional one. The failure lands in `walk.brokeAt` and `ok: false`.
 */
export function verifyAccountProof(args: {
  stateRoot: Hex;
  address: Address;
  /** `accountProof` from eth_getProof — RLP nodes, root first. */
  proof: readonly Hex[];
}): AccountProofResult {
  const started = performance.now();
  const pathKey = keccak256(args.address);
  const path = toNibbles(pathKey);
  const steps: ProofStep[] = [];

  let expected: ChildRef = { kind: 'hash', hash: args.stateRoot };
  let cursor: RlpItem[] | null = null;
  let rawLength = 0;
  let proofIdx = 0;
  let depth = 0;
  let pathIdx = 0;
  let accountRlp: Hex | null = null;
  let brokeAt: number | null = null;
  let absent = false;

  const finish = (): AccountProofResult => {
    const walk: ProofWalk = {
      stateRoot: args.stateRoot,
      pathKey,
      steps,
      brokeAt,
      ok: brokeAt === null,
      verifyMs: performance.now() - started,
    };
    let account: AccountState | null = null;
    if (brokeAt === null && accountRlp !== null) {
      account = decodeAccount(args.address, accountRlp);
    }
    return { walk, account, ok: brokeAt === null };
  };

  /**
   * `got` is the hash we actually computed for the node we were handed. Carrying
   * it matters: "the node you sent hashes to X, your parent says Y" is a far
   * more useful thing to show than "verification failed".
   */
  const fail = (why: string, got?: Hex): AccountProofResult => {
    brokeAt = depth;
    const last = steps[steps.length - 1];
    if (last && last.index === depth) last.matchesParent = false;
    else
      steps.push({
        index: depth,
        kind: 'branch',
        hash: got ?? '0x',
        rlpLength: 0,
        nibblesConsumed: 0,
        branchSlot: null,
        matchesParent: false,
      });
    void why;
    return finish();
  };

  // Bounded: a 64-nibble path cannot legitimately need more than ~70 nodes,
  // and an attacker must not be able to make us loop.
  for (let guard = 0; guard < 80; guard++) {
    if (absent || accountRlp !== null) return finish();

    // ---- obtain the next node and check it is the one the parent named ----
    if (cursor === null) {
      if (expected.kind === 'inline') {
        cursor = expected.node;
        rawLength = size(toRlp(expected.node as never));
      } else {
        const raw = args.proof[proofIdx++];
        if (raw === undefined || !isHex(raw)) return fail('proof ended early');
        const got = keccak256(raw);
        if (got !== expected.hash) return fail('node hash mismatch', got);
        rawLength = size(raw);
        const decoded = fromRlp(raw, 'hex') as RlpItem;
        if (!Array.isArray(decoded)) return fail('node is not a list');
        cursor = decoded;
      }
    }

    let kind: TrieNodeKind;
    try {
      kind = classify(cursor);
    } catch {
      return fail('malformed node');
    }

    const nodeHash: Hex =
      expected.kind === 'hash' ? expected.hash : keccak256(toRlp(cursor as never));

    // ---- descend ----
    if (kind === 'branch') {
      if (pathIdx === path.length) {
        // Path exhausted at a branch: the account's data sits in slot 16.
        const val = cursor[16];
        steps.push({
          index: depth,
          kind,
          hash: nodeHash,
          rlpLength: rawLength,
          nibblesConsumed: 0,
          branchSlot: 16,
          matchesParent: true,
        });
        if (typeof val !== 'string' || val === '0x') return fail('empty branch value');
        accountRlp = val;
        depth++;
        continue;
      }
      const slot = path[pathIdx] as number;
      const child = cursor[slot];
      if (child === undefined) return fail('branch missing slot');
      steps.push({
        index: depth,
        kind,
        hash: nodeHash,
        rlpLength: rawLength,
        nibblesConsumed: 1,
        branchSlot: slot,
        matchesParent: true,
      });
      pathIdx++;
      depth++;
      const ref = refFromChild(child);
      if (ref === null) {
        // Proven absent. The trie says there is nothing here, and it proved it.
        absent = true;
        continue;
      }
      expected = ref;
      cursor = null;
      continue;
    }

    // leaf or extension — both are [compactPath, rest]
    const encodedPath = cursor[0];
    const rest = cursor[1];
    if (typeof encodedPath !== 'string' || rest === undefined)
      return fail('malformed short node');

    let seg: { isLeaf: boolean; nibbles: number[] };
    try {
      seg = decodeCompactPath(encodedPath);
    } catch {
      return fail('malformed compact path');
    }

    const want = path.slice(pathIdx, pathIdx + seg.nibbles.length);
    const matches =
      want.length === seg.nibbles.length && seg.nibbles.every((n, i) => n === want[i]);

    steps.push({
      index: depth,
      kind,
      hash: nodeHash,
      rlpLength: rawLength,
      nibblesConsumed: seg.nibbles.length,
      branchSlot: null,
      matchesParent: true,
    });
    depth++;

    if (!matches) {
      // A leaf whose path diverges is how the trie proves absence.
      if (seg.isLeaf) {
        absent = true;
        continue;
      }
      return fail('extension path diverges');
    }

    pathIdx += seg.nibbles.length;

    if (seg.isLeaf) {
      if (pathIdx !== path.length) return fail('leaf reached at wrong depth');
      if (typeof rest !== 'string') return fail('leaf value is a list');
      accountRlp = rest;
      continue;
    }

    const ref = refFromChild(rest);
    if (ref === null) return fail('extension points nowhere');
    expected = ref;
    cursor = null;
  }

  return fail('walk did not terminate');
}

// ---------------------------------------------------------------------------
// Account decoding
// ---------------------------------------------------------------------------

const EMPTY_CODE_HASH: Hex =
  '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';
const EMPTY_TRIE_ROOT: Hex =
  '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421';

function toBig(item: RlpItem | undefined): bigint {
  if (typeof item !== 'string' || item === '0x') return 0n;
  return BigInt(item);
}

function toHash(item: RlpItem | undefined, fallback: Hex): Hex {
  if (typeof item !== 'string' || item === '0x') return fallback;
  return item;
}

/** An account leaf is RLP([nonce, balance, storageRoot, codeHash]). */
export function decodeAccount(address: Address, rlp: Hex): AccountState {
  const decoded = fromRlp(rlp, 'hex') as RlpItem;
  if (!Array.isArray(decoded) || decoded.length !== 4)
    throw new ProofError('account leaf is not a 4-item list', -1);
  return {
    address,
    nonce: toBig(decoded[0]),
    balance: toBig(decoded[1]),
    storageRoot: toHash(decoded[2], EMPTY_TRIE_ROOT),
    codeHash: toHash(decoded[3], EMPTY_CODE_HASH),
  };
}

/**
 * Verify one storage slot against an account's storageRoot. Same machinery,
 * different path key: storage is keyed by keccak256 of the padded slot index.
 */
export function verifyStorageProof(args: {
  storageRoot: Hex;
  slot: Hex;
  proof: readonly Hex[];
}): { walk: ProofWalk; value: Hex | null; ok: boolean } {
  const started = performance.now();
  const pathKey = keccak256(args.slot);
  // Reuse the account walk by treating storageRoot as the root; the only
  // difference is how the terminal value is interpreted.
  const inner = verifyPath({
    root: args.storageRoot,
    pathKey,
    proof: args.proof,
  });
  return {
    walk: { ...inner.walk, verifyMs: performance.now() - started },
    value: inner.terminal,
    ok: inner.walk.brokeAt === null,
  };
}

/**
 * The path walk with no opinion about what the terminal value means. Kept
 * separate so account and storage proofs share exactly one implementation of
 * the part that must not be wrong twice.
 */
function verifyPath(args: { root: Hex; pathKey: Hex; proof: readonly Hex[] }): {
  walk: ProofWalk;
  terminal: Hex | null;
} {
  // Delegate by synthesising an address-shaped call is not possible here
  // (pathKey is already hashed), so this mirrors verifyAccountProof's loop
  // over a pre-hashed key.
  const path = toNibbles(args.pathKey);
  const steps: ProofStep[] = [];
  let expected: ChildRef = { kind: 'hash', hash: args.root };
  let cursor: RlpItem[] | null = null;
  let rawLength = 0;
  let proofIdx = 0;
  let depth = 0;
  let pathIdx = 0;
  let terminal: Hex | null = null;
  let brokeAt: number | null = null;
  let absent = false;

  const mk = (): { walk: ProofWalk; terminal: Hex | null } => ({
    walk: {
      stateRoot: args.root,
      pathKey: args.pathKey,
      steps,
      brokeAt,
      ok: brokeAt === null,
      verifyMs: 0,
    },
    terminal: brokeAt === null ? terminal : null,
  });

  const fail = () => {
    brokeAt = depth;
    return mk();
  };

  for (let guard = 0; guard < 80; guard++) {
    if (absent || terminal !== null) return mk();

    if (cursor === null) {
      if (expected.kind === 'inline') {
        cursor = expected.node;
        rawLength = size(toRlp(expected.node as never));
      } else {
        const raw = args.proof[proofIdx++];
        if (raw === undefined || !isHex(raw)) return fail();
        if (keccak256(raw) !== expected.hash) return fail();
        rawLength = size(raw);
        const decoded = fromRlp(raw, 'hex') as RlpItem;
        if (!Array.isArray(decoded)) return fail();
        cursor = decoded;
      }
    }

    let kind: TrieNodeKind;
    try {
      kind = classify(cursor);
    } catch {
      return fail();
    }
    const nodeHash: Hex =
      expected.kind === 'hash' ? expected.hash : keccak256(toRlp(cursor as never));

    if (kind === 'branch') {
      if (pathIdx === path.length) {
        const val = cursor[16];
        steps.push({
          index: depth,
          kind,
          hash: nodeHash,
          rlpLength: rawLength,
          nibblesConsumed: 0,
          branchSlot: 16,
          matchesParent: true,
        });
        if (typeof val !== 'string' || val === '0x') return fail();
        terminal = val;
        depth++;
        continue;
      }
      const slot = path[pathIdx] as number;
      const child = cursor[slot];
      if (child === undefined) return fail();
      steps.push({
        index: depth,
        kind,
        hash: nodeHash,
        rlpLength: rawLength,
        nibblesConsumed: 1,
        branchSlot: slot,
        matchesParent: true,
      });
      pathIdx++;
      depth++;
      const ref = refFromChild(child);
      if (ref === null) {
        absent = true;
        continue;
      }
      expected = ref;
      cursor = null;
      continue;
    }

    const encodedPath = cursor[0];
    const rest = cursor[1];
    if (typeof encodedPath !== 'string' || rest === undefined) return fail();
    let seg: { isLeaf: boolean; nibbles: number[] };
    try {
      seg = decodeCompactPath(encodedPath);
    } catch {
      return fail();
    }
    const want = path.slice(pathIdx, pathIdx + seg.nibbles.length);
    const matches =
      want.length === seg.nibbles.length && seg.nibbles.every((n, i) => n === want[i]);

    steps.push({
      index: depth,
      kind,
      hash: nodeHash,
      rlpLength: rawLength,
      nibblesConsumed: seg.nibbles.length,
      branchSlot: null,
      matchesParent: true,
    });
    depth++;

    if (!matches) {
      if (seg.isLeaf) {
        absent = true;
        continue;
      }
      return fail();
    }
    pathIdx += seg.nibbles.length;

    if (seg.isLeaf) {
      if (pathIdx !== path.length) return fail();
      if (typeof rest !== 'string') return fail();
      terminal = rest;
      continue;
    }
    const ref = refFromChild(rest);
    if (ref === null) return fail();
    expected = ref;
    cursor = null;
  }
  return fail();
}
