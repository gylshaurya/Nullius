import type { Act, Address } from '@nullius/types';
import type { Endpoint } from '@nullius/provider';

const env = import.meta.env;

/**
 * The endpoint set. `fork` is a local Anvil fork of real mainnet state; `evil`
 * is our own deliberately dishonest proxy in front of it. Both are real
 * endpoints answering real JSON-RPC — the liar is not a mock.
 */
/**
 * Two genuinely independent mainnet endpoints, plus our own liar in front of one
 * of them.
 *
 * These are real nodes serving real `eth_getProof` for real mainnet state, which
 * matters twice over: the proofs are the article rather than a fixture, and the
 * anchor is corroborated across operators who do not share a backend. An Anvil
 * fork cannot fill this role — it has no forked trie of its own, so it proxies
 * every proof upstream and gets rate-limited, and its "sync" would have to be
 * labelled simulated. Anvil stays on 8545 for the send path, where a funded
 * account is what's needed.
 */
export const ENDPOINTS: Endpoint[] = [
  {
    id: 'blast',
    label: 'blastapi',
    adversarial: false,
    url: env.VITE_RPC_A ?? 'https://eth-mainnet.public.blastapi.io',
  },
  {
    id: 'tenderly',
    label: 'tenderly gateway',
    adversarial: false,
    url: env.VITE_RPC_B ?? 'https://gateway.tenderly.co/public/mainnet',
  },
  {
    id: 'evil-rpc',
    label: 'evil-rpc',
    adversarial: true,
    url: env.VITE_EVIL_RPC ?? 'http://127.0.0.1:8546',
  },
];

export const MODE: 'fork-demo' | 'live-mainnet' =
  env.VITE_MODE === 'fork-demo' ? 'fork-demo' : 'live-mainnet';

/** Where the flight recorder's signed transaction goes. */
export const SEND_RPC = env.VITE_FORK_RPC ?? 'http://127.0.0.1:8545';

/**
 * Accounts read on load. Real mainnet addresses with real balances — the point
 * is undermined by fixtures.
 */
export const WATCHED: Array<{ address: Address; label: string }> = [
  { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', label: 'vitalik.eth' },
  // Every row is an ETH balance from the state trie. The USDT row is the ETH the
  // token contract itself holds — not a USDT balance — and the label has to say
  // so, because a judge who reads it as "USDT" has been misled by us.
  {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    label: 'USDT contract · ETH held',
  },
  { address: '0x00000000219ab540356cBB839Cbe05303d7705Fa', label: 'Beacon deposit contract' },
];

export const ACTS: Act[] = [
  {
    id: 'lie',
    numeral: 'I',
    title: 'The lie',
    claim:
      'The same account read twice. One endpoint serves a proof that hashes to the state root. The other serves a balance a hundred times too large, and a proof that breaks at a nameable depth.',
    drives: ['register', 'plate'],
  },
  {
    id: 'route',
    numeral: 'II',
    title: 'The route',
    claim:
      'Live relay data, counted rather than inferred. Then one transaction multicast across routes, with a receipt from each and a record of which went silent.',
    drives: ['radar', 'recorder'],
  },
  {
    id: 'quorum',
    numeral: 'III',
    title: 'The quorum',
    claim:
      'A signal gated on proven holdings rather than on identity. Every member of the set had their balance demonstrated against the same root.',
    drives: ['quorum'],
  },
];

/** Threshold for the quorum gate, in wei. 1 ETH. */
export const GATE_WEI = 1_000_000_000_000_000_000n;

export const MOTION = 'nullius/quorum · should unverifiable values be displayed at all?';
