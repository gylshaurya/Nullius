# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

pnpm workspaces monorepo — Vite + React + wagmi/viem for the app, Foundry for contracts, Noir + `bb.js` for the ZK circuit. Chosen by the user from an offered set, specifically to support four isolated parallel workstreams coding against a frozen shared types package.

```
nullius/
├─ packages/
│  ├─ types/      # frozen at hour zero; the only shared surface
│  ├─ provider/   # light client + MPT proof verification
│  ├─ route/      # censorship radar + multicast sender
│  ├─ id/         # Noir circuit + proving glue
│  └─ quorum/     # Semaphore + RLN
├─ apps/
│  ├─ web/        # Vite + React + wagmi — demo app
│  └─ evil-rpc/   # deliberately lying RPC proxy (demo instrument)
└─ contracts/     # Foundry
```

## Users

Two audiences, both real, with different success conditions. Design must serve both without pretending they are one.

**Primary — hackathon judges with genuine technical depth.** They are evaluating many submissions in a short window, in person or by skim. They know this space: they know what `eth_getProof` is, they know MACI's actual insight, and they will catch an overstated trustlessness claim instantly. Their job is to decide, fast, whether this project understood the problem better than the others. What earns them: a correct technical argument, visible proof rather than assertion, and honesty about trust boundaries.

**Secondary — the Ethereum user whose wallet currently believes whatever an RPC endpoint tells it.** Not a research audience. They hold assets, sign transactions, and have no idea that `eth_getBalance` is a social claim with no cryptography in the path. The product only matters if this person's actual position improves.

## Product Purpose

NULLIUS (from *nullius in verba* — "take nobody's word for it") is a client-side trust-deletion layer for Ethereum. It exists because the read path of every mainstream wallet is unverified: an RPC provider asserts state, the UI renders the assertion, the user believes it.

NULLIUS replaces assertion with proof. It syncs an Ethereum light client in the browser to obtain a verified execution state root, then upgrades reads into `eth_getProof` and verifies the Merkle-Patricia path locally. A provider that lies is **rejected**, not out-voted.

Success is defined by the hackathon, and honestly: win at least one of three tracks, ideally more than one. A judge should be able to state the thesis back in one sentence after four seconds of demo.

## Positioning

The mechanism a neighboring project cannot truthfully copy is the **refusal of the consensus-among-providers model**.

The Censorship Resistance track brief asks for RPC aggregators that "implement consensus mechanisms among providers." That is a weak security model: several endpoints often share one backend, all of them can be wrong together, and majority-vote hands an attacker a price list — buy 3 of 5. NULLIUS argues the correct primitive has existed since EIP-1186: don't vote, verify. One honest provider is sufficient; zero honest providers means you **fail closed** rather than get lied to. Liveness degrades; safety does not.

Having a defensible reason to decline the brief's own suggestion is the position. Everything else in the product follows from it.

## Operating Context

- **12-hour build window.** This is the dominant constraint on every decision. Integration failure, not typing speed, is the realistic way this dies.
- **Judging is a skim followed by a short live demo.** The submission is read under time pressure, possibly without the author present.
- **One project, three submissions.** The same repository is submitted to all three tracks with three README framings, each opening in that track's language and leading with the module that serves it.
- **Demo runs against real state.** Testnet deploy plus an Anvil mainnet-fork so proof and ZK demos operate on genuine mainnet data.
- The four modules map to tracks: `provider` → Censorship Resistance + Self-Sovereignty · `route` → Censorship Resistance · `id` → Self-Sovereignty · `quorum` → Decentralized Coordination Layers.

## Capabilities and Constraints

**Confirmed scope — four modules, all four building:**

- `provider` — verifying EIP-1193 provider. Browser light client (`@lodestar/light-client` or Helios-WASM) → verified beacon headers → execution `state_root`. Read methods upgraded to `eth_getProof` and verified via local MPT walk. Fan-out over N providers where **the first response that verifies wins**. Every value carries a trust level.
- `route` — censorship radar from public relay data APIs; per-relay and per-builder inclusion behavior; multicast transaction send across measured non-censoring routes; per-transaction flight recorder with first-seen timestamps and a transaction-trie inclusion proof.
- `id` — Noir circuit proving *"an account exists in the state trie at block B with balance ≥ T"* in zero knowledge, emitting a nullifier. On-chain verifier, block anchoring via `blockhash` or EIP-4788. Sybil resistance that costs real capital per identity and discloses nothing.
- `quorum` — Semaphore v4 anonymous signaling with RLN rate-limiting, membership gated on `id` proofs. Group state on-chain; no server holds it.
- `evil-rpc` — a transparent proxy that inflates `eth_getBalance` 100×. A demo instrument, and a first-class part of the deliverable.

**Hard technical constraints:**

- Four trust levels are a product-level concept, not a UI flourish: `PROVEN` (Merkle-verified against the anchored root), `ATTESTED` (agreement only, no proof offered), `UNVERIFIABLE` (`eth_call`, gas estimation, log filters in the general case), and `REJECTED` (a proof was offered and its hash chain does not reach the root). **Unverifiable values must be visibly marked as such**, and all four must be distinguishable without relying on colour. Claiming trustlessness the system does not have is a product failure, not a copy nitpick.
- The system's one standing trust assumption is the weak-subjectivity checkpoint. It is stated plainly, never obscured.
- Anonymity is not collusion resistance. `quorum` gives anonymity via Semaphore; receipt-freeness requires key switching (MACI's insight). The distinction is stated accurately wherever the product describes itself.

**Known-risk items with pre-agreed fallbacks** (these are product facts, since they change what ships):

- Light-client sync may be too slow or flaky in-browser → fall back to checkpoint roots pinned from ≥3 independent sources, documented as a limitation.
- The Noir MPT circuit may not prove in acceptable browser time → fall back to a Poseidon Merkle tree of qualifying holders built from verified proofs, with the snapshot assumption stated openly. Hard decision checkpoint at hour 5.
- Verifiable `eth_call` may not generalize → scope to ERC-20 `balanceOf` and describe the general access-list prefetch loop.

**Explicitly undecided:** whether MACI is integrated or cited as prior art (expected: cited). Whether the ZK module ships Plan A or Plan B. Deploy target testnet not yet chosen.

## Brand Commitments

- **Name: NULLIUS**, from the Royal Society motto *nullius in verba*. The name carries the entire thesis and is binding.
- Module names are `nullius/provider`, `nullius/route`, `nullius/id`, `nullius/quorum`. The malicious proxy is `evil-rpc`.
- **Voice: precise, unhedged, and scrupulously honest about limits.** The audience punishes overstatement harder than it punishes modest scope. "What we do NOT prove" is treated as a feature of the product, not a disclaimer.

## Evidence on Hand

- `IDEAS.md` (repo root) — the full strategy document: four candidate directions, module architecture, 12-hour plan, risk register, stack decisions, and anticipated judge questions. This is the authoritative brief.
- Verbatim track text for all three tracks, supplied by the user, including prize structure ($100 per track, 1 prize each).
- **Real measurements will exist and are the product's strongest evidence:** live relay data from public relay APIs, and verifier results run against major public RPC endpoints. Any embarrassing finding there is a genuine outcome, not a mock.
- **Nothing else exists yet.** No users, no testimonials, no benchmarks, no press, no partners, no logo, no deployed contracts, no prior codebase. Future work must not fabricate any of these. Numbers shown in the interface come from live measurement or are labeled as simulated.
- **EIP-8141 — verified 2026-08-08.** Titled **"Frame Transaction"**, status Draft, Standards Track: Core, targeted for the **Bogota** fork. It defines a new EIP-2718 transaction type that decomposes a transaction into a sequence of *frames* — contract calls that validate the transaction, authorise gas payment, and execute the user's operation. That makes validation and fee payment abstract and EVM-defined, so an account can use any signature scheme rather than one ECDSA signature; default code extends the benefits to existing EOAs. This is **native** account abstraction, which is why the track text pairs it with ERC-4337 (the contract-level approach). Related: EIP-8250 (keyed nonces for frame transactions), EIP-8130. Safe to cite, with its Draft status stated.
- A recorded backup demo was offered and not selected. Live-demo failure therefore remains an accepted, unmitigated risk.

## Product Principles

1. **Prove, don't poll.** Cryptographic verification replaces provider agreement wherever it is possible. Agreement is a labeled fallback, never presented as security.
2. **Fail closed, and say so.** Refusing to display an unverifiable value is correct behavior. Degraded liveness is an acceptable price for safety; silent belief is not.
3. **Name the trust you keep.** Every remaining trust assumption is surfaced rather than buried. Precision about limits is what earns this audience.
4. **The demo is the argument.** The `evil-rpc` side-by-side — a stock dapp rendering a lie next to NULLIUS rejecting it — must be visible in four seconds and must exist early, mocked if necessary.
5. **One thesis, four modules, no filler.** Every element traces back to deleted trust. Nothing ships because it looked impressive.

## Accessibility & Inclusion

No product-specific requirement was established in the interview. Standard baseline applies; no exemption is claimed.
