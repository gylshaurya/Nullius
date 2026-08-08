# nullius/id — anonymous membership, in zero knowledge

A Noir circuit proving:

> *I know a secret whose commitment is a leaf of the tree with root `root`, and the
> nullifier I am publishing is derived from that same secret and this `context`.*

**Reveals:** the root, the context, the nullifier.
**Does not reveal:** which leaf, the secret, or the address.

So a signal is attributable to the set and to no member of it, and the same member
cannot signal twice on one context, because the nullifier is deterministic.

## Reproduce it

Needs `nargo` (via [noirup](https://noir-lang.org)) and `bb` (via `bbup`). Then:

```bash
pnpm --filter @nullius/id all
```

That runs the tests, compiles, solves the witness, writes a verification key,
produces a proof, and verifies it. Measured on this machine:

| | |
|---|---|
| Tests | 3 passed, including 2 negative |
| ACIR opcodes | 29 |
| Circuit size | 481 gates |
| Proof system | UltraHonk (bb 5.1.0) |
| Proof | 14,656 bytes, verifies |

The negative tests are the interesting ones. `wrong_root_is_rejected` shows a path
to a root nobody can produce is refused; `forged_nullifier_is_rejected` shows a
nullifier not derived from the secret is refused. A circuit that only passes its
happy path has demonstrated nothing.

You can also confirm the proof is bound to its public inputs — flip a byte of
`target/public_inputs` and `bb verify` fails at the reduction step.

## What this does NOT prove

Say this before anyone asks.

- **The tree's membership rule.** Every leaf was admitted because a
  Merkle-Patricia proof of its balance verified against a real Ethereum state
  root — but that happened *outside* this circuit, in the client. Membership is
  therefore a snapshot a verifier must accept, not something proven here. Proving
  it in-circuit means walking the state trie inside the circuit, which means
  keccak over every RLP node. That is the expensive path, documented as Plan A and
  not built.
- **Collusion resistance.** A member can still choose to hand their secret to a
  briber. Receipt-freeness needs the ability to secretly replace your key — MACI's
  contribution, cited rather than reimplemented.
- **Browser proving.** The circuit is verified here via the `bb` CLI. Wiring it
  into the app needs a JS implementation of exactly this circuit's hash
  construction, because Noir 1.0 exposes only `poseidon2_permutation` and no JS
  library reproduces that sponge off the shelf. Until that exists, the app's
  quorum panel says the anonymity is not yet zero-knowledge *in the app* — which
  is true, and is not the same claim as the circuit not existing.

## Why keccak was rejected

keccak256 would have made the circuit and the client provably agree, since
`viem.keccak256` reproduces it byte for byte. But keccak256 moved out of Noir's
stdlib into a separate library, and adding a network-fetched dependency to buy
JS-compatibility we then didn't use would have been the worst of both. The
construction is recorded here so the JS side can be written against it rather
than guessed at.
