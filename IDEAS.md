# Road to Devcon — Project Ideas

**Constraints:** 12h build window · Claude Code doing the implementation · 3 tracks ($100 each, 1 prize each) · **one project may be submitted to all three tracks.**

---

## 0. The meta-read: these three tracks are one thesis

Look at what the three tracks are actually asking for:

| Track | The real question |
|---|---|
| Decentralized Coordination Layers | Can a group agree on something without a platform in the middle? |
| Censorship Resistance | Can your bytes reach the chain when someone doesn't want them to? |
| Self-Sovereignty | Can you hold assets and identity without asking permission? |

All three collapse into a single sentence: **"which parts of your Ethereum experience are you still trusting a third party for, and can we delete that trust?"**

Every one of the sponsor's suggested ideas is a *symptom*. The bullet "Decentralized RPC Aggregators: distribute requests across providers, implement consensus mechanisms among providers" is, respectfully, the **wrong solution** — polling 5 RPCs and taking the majority is a popularity contest, not a security model. All 5 can be wrong, several are the same Infura/Alchemy backend behind different domains, and majority-vote gives an attacker a cost model (buy 3 of 5). The correct answer has been sitting in EIP-1186 since 2018: **don't vote — verify**. Ask for a Merkle proof against a state root you obtained from a light client, and a single honest provider is enough. Zero honest providers just means you fail closed instead of getting lied to.

**Saying that out loud to a technically deep judging panel is worth more than any amount of UI polish.** You are not building the thing on the list; you are building the thing the list was groping toward, and you can articulate why. That is what wins hackathons where judges have depth.

**Strategy: build ONE coherent product with four modules**, each of which independently satisfies a track. Submit the same repo three times with three different framings of the README. Not three shallow projects — one deep project seen from three angles.

---

## 1. ⭐ RECOMMENDED — **NULLIUS**

> *nullius in verba* — "take nobody's word for it." (Royal Society motto, 1660.) A client-side trust-deletion layer for Ethereum.

**One-liner:** Your wallet currently believes whatever an RPC endpoint tells it. Nullius is a drop-in EIP-1193 provider that refuses to believe anything it can't prove, plus the routing, identity, and coordination tools that fall out of that principle once you have it.

### The pitch in 30 seconds
Right now, `eth_getBalance` is a **social** claim. Alchemy says you have 4.2 ETH; MetaMask draws "4.2 ETH"; you believe it. There is no cryptography anywhere in that path. Nullius replaces the claim with a proof: it syncs an Ethereum light client in your browser tab (sync-committee signatures → verified execution state root), then upgrades every read into `eth_getProof` and verifies the Merkle-Patricia path itself. An RPC that lies gets **rejected**, not out-voted.

### Four modules → three tracks

#### **`nullius/provider`** → *Censorship Resistance* + *Self-Sovereignty*
A verifying EIP-1193 provider you can hand to any existing dapp (viem/wagmi/ethers all take a custom transport).

- Browser light client via **`@lodestar/light-client`** (TS, runs in a tab) or **Helios** compiled to WASM. Syncs from a weak-subjectivity checkpoint → verified beacon headers → execution payload `state_root`.
- Read-method interception. `eth_getBalance` / `eth_getStorageAt` / `eth_getCode` / `eth_getTransactionCount` are silently upgraded to `eth_getProof` and verified against that `state_root` with an MPT walk (`@ethereumjs/mpt`, or ~250 lines hand-rolled — RLP decode, keccak each node, check the nibble path).
- Fan-out over N heterogeneous providers, but the aggregation rule is **"first response that verifies wins"**, not majority. Log which providers returned unverifiable garbage and how often. That log is a public good.
- Methods that *cannot* be proven (`eth_call`, `eth_estimateGas`, log filters) get flagged in the UI with an explicit **trust badge**: `PROVEN` / `ATTESTED-BY-N` / `UNVERIFIABLE`. Being honest about what you *can't* prove is itself a strong signal to expert judges. Bonus: `eth_call` can be made verifiable by fetching proofs for every slot the call touched and re-executing locally in an EVM (`@ethereumjs/evm`) — implement it for one hot path (ERC-20 `balanceOf`) as a proof of concept and describe the general case.

#### **`nullius/route`** → *Censorship Resistance* (this is the track-winner)
"Verifiable routing infrastructure — let users verify network path integrity and route around censorship." Concretely:

- **Censorship Radar.** Continuously ingest the public relay data APIs (`/relay/v1/data/bidtraces/proposer_payload_delivered`) across relays — Flashbots, bloXroute (regulated *and* max-profit), Agnostic, Ultra Sound, Aestus, Titan — and cross-reference delivered payloads against blocks. Compute, live: per-relay and per-builder inclusion behaviour, and **which addresses/tx-types get systematically skipped**. This is measurable, real, and nobody does it in a wallet.
- **Route selection.** On send, don't just `eth_sendRawTransaction` into the void. Multicast to a set of builders/private endpoints chosen by measured non-censoring behaviour, plus the public mempool, and produce a **flight recorder**: signed submission receipts where available, first-seen timestamps, per-route inclusion latency, and the block your tx actually landed in with a proof it's in the transaction trie of a light-client-verified header.
- **The killer scenario:** simulate (or find) a censoring path and show the tx being *silently dropped* by route A while route B includes it — with the recorder showing exactly who dropped it and when. Frame it against **FOCIL / forced inclusion lists** as the protocol-level fix, positioning Nullius as the measurement and mitigation layer that exists *today*, before that ships.

#### **`nullius/id`** → *Self-Sovereignty* (sybil resistance without identity)
"ZK-based proofs for ETH holdings rather than full identity disclosure."

- A **Noir** circuit that takes an `eth_getProof` account proof and proves in zero knowledge: *"there exists an account in the state trie at block B whose balance ≥ T"*, emitting a nullifier so each account can be used once per context. Verifier contract on-chain; block anchoring via `blockhash` for recent blocks or **EIP-4788** beacon roots for historical.
- Result: a Sybil gate that costs an attacker **real capital per identity** and reveals **nothing** — no address, no KYC, no Worldcoin orb, no social graph. Composes with the rest: gate `nullius/quorum` membership on it.
- ⚠️ **This is the highest-risk module.** In-circuit keccak over ~8–10 MPT nodes is expensive and browser proving time may be brutal. **Have Plan B ready and be upfront about it** (see Risk Register).

#### **`nullius/quorum`** → *Decentralized Coordination Layers*
"Lightweight anti-collusion voting/signaling without centralized infrastructure or platform metrics."

- **Semaphore v4** groups for anonymous membership + signaling, with membership derived from `nullius/id` proofs — so the anonymity set is "people with ≥T ETH," provable, and un-Sybil-able.
- Layer on the **anti-collusion** property properly: either integrate **MACI** (key-change → bribes unprovable, which is the actual anti-collusion mechanism, not just anonymity) or, if MACI is too heavy for 12h, implement the key-switching primitive minimally and *cite MACI as prior art*. **Do not conflate anonymity with collusion resistance in your pitch** — a judge who knows this space will catch it instantly, and knowing the difference is a credibility win.
- Add **RLN (rate-limiting nullifiers)** so spam costs a stake slash rather than needing a moderator.
- All state on-chain / in the contract; no server holds the group.

### The demo (this is what actually wins)

Five minutes, three beats. Build the demo harness *first* — it dictates the architecture.

1. **`evil-rpc`.** Ship a small malicious RPC server in the repo. It's a transparent proxy that intercepts exactly one thing: it inflates `eth_getBalance` 100×. Point a stock wagmi dapp at it → the UI cheerfully renders **420 ETH**. Point Nullius at the *same* endpoint → red banner: `PROOF FAILED — state root mismatch — provider evil-rpc rejected`, and it transparently fails over to a provider that verifies. **This single side-by-side is the whole thesis, visible in four seconds.** Nobody forgets it.
2. **Censorship Radar, live.** Real relay data on screen. "This relay delivered 12,400 payloads today and has never once included a tx touching this contract." Send a tx, watch the flight recorder fill in per-route, show inclusion + trie proof.
3. **Anonymous stake-gated vote.** Prove ≥1 ETH in ZK, join the group, cast a signal. Show the on-chain verifier accepting the proof. Show that the chain learned a nullifier and nothing else.

### Why each judge nods
- **Coordination judge:** it's the only submission where the anti-Sybil layer is *cryptographic and capital-based* rather than "we'll check Twitter followers."
- **Censorship judge:** you rejected the brief's own suggestion (provider voting) with a correct technical argument and shipped the stronger primitive. Plus you have *measurements*, not vibes.
- **Self-sovereignty judge:** you deleted trust from the read path, which is the part of the stack everyone else hand-waves. "Your smart account is only as sovereign as the RPC that tells it what state it's in."
- **All three:** one architecture, four modules, no filler. The through-line is legible.

---

## 2. Alternative — **The Liar's Ledger** (narrow, safe, still excellent)

Cut Nullius down to *only* `provider` + `evil-rpc`, and go extremely deep instead of wide.

- Verifiable `eth_call` via local re-execution against proof-fetched state (the general case, done properly, with an access-list-driven proof prefetch loop).
- Verifiable event logs via receipt-trie proofs → makes the **token-approvals dashboard** from the Self-Sovereignty bullet list *trustless*, which no existing revoke tool is: Revoke.cash trusts an indexer. Yours proves every approval from receipt proofs against verified headers, then bulk-revokes via an ERC-4337 batch. That's a real, shippable improvement on a tool people actually use.
- A public **RPC honesty leaderboard**: run the verifier against every major free endpoint for an hour and publish who's serving stale roots, silently-pruned state, or wrong answers. Expect to find genuinely embarrassing results — that finding *is* the submission.

**Trade-off:** hits Censorship Resistance + Self-Sovereignty hard, Coordination barely. Two tracks instead of three, but very low risk of a broken demo. Take this if hour 6 is going badly.

---

## 3. Alternative — **Black Box** (measurement-first, data-heavy)

Pure `nullius/route`, expanded into a serious instrument: a real-time censorship observatory for Ethereum.

Per-relay and per-builder censorship scoring; OFAC-list correlation; detection of *soft* censorship (systematic inclusion delay rather than outright exclusion, which is what actually happens in practice and is much harder to spot); a public API + embeddable widget; a `sendTransaction` shim that routes by live score and emits a signed flight recorder trace.

**Why it could win:** it produces a *finding*, and findings beat demos with research-minded judges. **Why it might not:** it's data engineering with little cryptography, and single-track.

---

## 4. Alternative — **Citizen** (all-in on the ZK bet)

Only `nullius/id`, done to a very high standard: MPT-account-proof-in-Noir, EIP-4788 historical anchoring, an ERC-standard-shaped verifier interface others can adopt, gas-golfed on-chain verification, and a clean SDK.

"Prove you are an Ethereum stakeholder without revealing which one." Genuinely useful primitive, strong narrative, plausibly a real ERC.

**Why not lead with it:** if the circuit doesn't converge by hour 8 you have *nothing to demo*, and a 12h window has no room for a rescue. Great as a module inside Nullius, dangerous as the whole bet.

---

## 5. 12-hour plan

The real bottleneck isn't typing speed — it's **integration**. Parallel agents that discover incompatible assumptions at hour 9 is how this fails. So:

**H0–H0:45 — Contracts before code.** Write `packages/types/index.ts` and *freeze it*: the `VerifiedResult<T>` shape, `TrustLevel` enum, `RouteReceipt`, `ProofBundle`, the module boundaries. Set up the monorepo (pnpm workspaces, one Vite app, one Foundry project). Every parallel workstream codes against these types and nothing else. **This single step is worth two hours later.**

**H0:45–H7 — Four parallel workstreams** (separate worktrees, no shared files outside `types`):
- **A — Light client + MPT verifier.** Highest uncertainty in the core path; start it first and check in at H2. If light-client sync is fighting you, fall back to *pinned trusted checkpoint roots* fetched from multiple independent sources and be explicit in the README that full sync is the next step. The MPT verification is the interesting part and it still holds.
- **B — Route + Radar.** Relay data ingestion, scoring, multicast sender, flight recorder. Mostly independent; lowest risk; will look great early.
- **C — ZK id.** Noir circuit + verifier contract. **Hard checkpoint at H5:** if proving isn't working end-to-end, drop to Plan B immediately, no negotiation.
- **D — App shell, `evil-rpc`, and the demo script.** Build the malicious-RPC demo on day one against mocked verification so the money shot is guaranteed to exist regardless of what else lands.

**H7–H9 — Integration.** Wire real modules behind the frozen interfaces. Kill anything not integrated by H9 — a half-wired module is worse than an absent one.

**H9–H10:30 — The demo.** Rehearse it three times. Record a backup video. Live demos die.

**H10:30–H12 — Three READMEs.** Same repo, three framings, each opening with that track's language and leading with the module that serves it. Architecture diagram. An explicit **"What we do NOT prove"** section — the fastest way to earn a technical judge's trust is to show them you know exactly where your own trust boundaries are.

---

## 6. Risk register

| Risk | Likelihood | Fallback |
|---|---|---|
| Browser light-client sync is slow/flaky | **High** | Pin checkpoint roots from ≥3 independent sources; verify proofs against those. Document as a known limitation with a clear path to full sync. Demo still works. |
| Noir MPT circuit too expensive / won't prove in-browser | **High** | **Plan B:** Poseidon Merkle tree of qualifying holders, root built from *verified* proofs off-line and posted on-chain — proving becomes trivial, and you honestly state the snapshot trust assumption. **Plan C:** Semaphore group seeded from a verified snapshot. Ship B, describe A as the design. |
| `eth_call` verification generalises badly | Medium | Scope to ERC-20 `balanceOf` + one contract read. Describe the general access-list prefetch loop in the README. Partial is fine if labelled. |
| MACI integration eats the day | **High** | Don't integrate MACI. Ship Semaphore + RLN, implement key-switching minimally, cite MACI as prior art, and be precise that anonymity ≠ collusion resistance. |
| No live censorship event during the demo | Medium | Pre-record a real one from historical relay data, *plus* ship a local censoring-builder simulator so the mechanism is reproducible on demand. |
| Four parallel workstreams don't integrate | Medium | The H0 frozen-types step, and the H9 hard cutoff. |

---

## 7. Stack

- **Chain/read:** viem (custom transport = the natural injection point), `@lodestar/light-client` or Helios-WASM, `@ethereumjs/mpt` + `@ethereumjs/rlp`, `@ethereumjs/evm` for local re-execution.
- **ZK:** Noir + `bb.js` (browser proving), Poseidon for the fallback tree, Semaphore v4, RLN.
- **Accounts:** ERC-4337 (permissionless.js / Alchemy AA SDK) — session keys, sponsored gas, batched revokes. Modern smart-account stack to look at: **EIP-7702** (EOA→code delegation, live since Pectra) and **ERC-7579 / ERC-6900** for modules. **EIP-8141 "Frame Transaction"** (verified: Draft, Standards Track Core, targeted at the Bogota fork) is the *native* account-abstraction route — a new EIP-2718 transaction type split into validate / authorise-gas / execute frames, so signature schemes and fee payment become EVM-defined rather than fixed, and default code extends the benefits to plain EOAs. The track pairs it with ERC-4337 because they are the protocol-level and contract-level answers to the same problem.
- **Contracts:** Foundry. Deploy to a testnet *and* have a mainnet-fork demo (Anvil `--fork-url`) so the ZK/proof demos run against real state.
- **Front end:** Vite + React + wagmi. Keep it plain and fast; the trust badges are the entire design language. No time for polish, and polish isn't what's being judged here.

---

## 8. Don't

- **Don't build provider majority-voting** as the actual security mechanism. Build proofs; mention voting only as the strawman you're replacing.
- **Don't ship a fourth module.** Four is already ambitious for 12h.
- **Don't claim trustlessness you don't have.** One overstated claim in the README and a sharp judge discounts everything else. The "What we do NOT prove" section is a feature.
- **Don't leave the demo until the end.** Beat #1 (`evil-rpc` side-by-side) should exist by hour 4, mocked if necessary.
- **Don't spend time on a landing page.** Spend it on the architecture diagram.

---

## 9. Questions to prep for

- *"How do you get the state root without trusting someone?"* → sync committee signatures over beacon headers; weak subjectivity checkpoint is the only trust assumption, and it's a well-understood one. Say exactly that.
- *"What if all providers refuse to serve proofs?"* → you fail closed and say so, which is strictly better than being lied to. Liveness degrades; safety doesn't.
- *"Isn't `eth_getProof` support inconsistent across providers?"* → yes, and measuring that is one of our outputs.
- *"Is your voting actually collusion-resistant, or just anonymous?"* → **know the honest answer** before you're asked. Anonymity alone doesn't stop bribery; the receipt-freeness has to come from key switching (MACI's insight).
- *"How is your ZK ETH-holdings proof not just a snapshot?"* → depends on whether Plan A or Plan B landed. Answer truthfully.
