# Nullius, in plain words

This document explains the whole system from the ground up. No jargon is used without being explained first.

Sections 1 to 4 explain the idea. Sections 5 to 8 explain each module. Sections 9 to 11 cover the limits, the common questions, and a glossary.

---

## 1. The problem, in one paragraph

When your wallet shows you "4.2 ETH", where did that number come from?

It came from a company. Your wallet asked a server — Infura, Alchemy, whatever endpoint is in your settings — "how much ETH does this address have?" The server replied "4.2". Your wallet drew "4.2 ETH" on the screen.

That's it. There is no cryptography anywhere in that exchange. No signature, no proof, no check. The number on your screen is a **claim made by a company**, and your wallet believes it the way you believe a stranger telling you the time.

This is true of nearly every number you see in crypto. Your balance, your token holdings, your NFT ownership, whether a transaction succeeded, what a contract's state is. All of it arrives as an unverified assertion from a server you don't control, and the entire interface renders it as fact.

**NULLIUS is the layer that stops believing and starts checking.**

The name is from *nullius in verba* — Latin for "take nobody's word for it." It's the motto the Royal Society adopted in 1660, when the founding idea of modern science was that a claim should be demonstrated rather than asserted on authority. That is exactly the change we're making to Ethereum's read path.

---

## 2. Why this is worse than it sounds

Three reasons this isn't a theoretical concern.

**It's centralized.** A very large share of all Ethereum reads flow through a handful of companies. If Infura returns wrong data — by bug, by compromise, by court order, by regional policy — millions of wallets display wrong data and there is no mechanism anywhere in the stack that would notice.

**It's invisible.** A lying server doesn't look different from an honest one. There's no error, no warning, no broken padlock icon. The UI renders the lie in the same font as the truth. You cannot tell, ever, by looking.

**It's exploitable.** If an attacker can make your wallet believe a false balance, a false allowance, or a false "this transaction succeeded", they can walk you into signing something you never would have signed. The read path is an attack surface that most people don't even model as one.

And here's the part that lands with a technical audience: **Ethereum already solved this.** The cryptography to fix it has been in the protocol for years. Almost nobody uses it. We built the thing that uses it.

---

## 3. How Ethereum makes this fixable

You need two ideas. Both are simpler than they sound.

### Idea one: the state root

Ethereum stores all of its accounts in a giant tree-shaped data structure. Every account — your balance, your nonce, your contract code, your contract's storage — is a leaf in that tree.

The tree has a special property. Each node in it is identified by the **hash** of its contents. (A hash is a fixed-size fingerprint of some data. Change one bit of the data and the fingerprint changes completely and unpredictably. You cannot construct data to match a chosen fingerprint.) Because each node's identity is the hash of its contents, and each parent contains the identities of its children, the single hash at the very top of the tree — the **state root** — is a fingerprint of *every account on Ethereum simultaneously*.

Change any balance anywhere, and the state root changes.

**And that state root is written into every block header.** It's part of the chain. It's agreed by consensus. Hundreds of thousands of validators attest to it.

### Idea two: the Merkle proof

Because of how the tree works, a server can prove a specific account's contents to you without sending you the whole tree.

It sends you the **path**: the handful of nodes running from the top of the tree down to your account's leaf, plus the sibling hashes along the way. You then do the work yourself. You hash your account's data. You check that hash appears in its parent. You hash the parent. You check *that* appears in its parent. You walk all the way up. And at the top you compare what you computed against the state root you already know is correct.

If they match, the data is genuine. Not "probably genuine", not "the server seems trustworthy" — genuine, in the same sense that 2+2=4. The only way to forge it would be to break the hash function.

If they don't match, the server lied, and you know it with certainty.

Ethereum exposes this as an RPC method called `eth_getProof` — standardised in **EIP-1186**, in 2018. Any node can serve it. Almost no wallet asks for it.

> **The one-sentence version:** the proof is a short chain of hashes you can check yourself, ending at a number the whole network already agreed on.

### The remaining question: how do you know the right state root?

You could ask a server for the latest block header — but then you're trusting a server again, and we've gone in a circle.

The answer is a **light client**. Ethereum's consensus layer has a mechanism designed exactly for this. Every ~27 hours, 512 validators are selected as the **sync committee**, and they sign block headers. Their signatures are aggregated into one compact signature you can verify cheaply — cheaply enough to do in a browser tab.

So a light client follows the chain by checking sync-committee signatures. It doesn't download or execute the chain; it just verifies that the validators who were supposed to sign a header actually did. From the header it reads the state root.

It needs one starting point: a recent block hash you accept as real, called a **weak subjectivity checkpoint**. That is the system's one honest trust assumption, and we state it openly everywhere. It's a well-understood assumption — every Ethereum client makes it — and it's an enormously smaller thing to trust than "whatever Alchemy says my balance is, forever."

---

## 4. Don't vote, verify

The obvious way to distrust one RPC provider is to ask five and take the majority. We think that is the wrong answer, and this section is why. It is the design decision the whole project rests on.

Polling five providers and taking the majority answer is a **vote**. Votes have three problems here:

1. **The voters aren't independent.** Many "different" RPC endpoints are resold access to the same few backends. You think you polled five sources; you polled one source five times.
2. **They can all be wrong together.** A bug in a popular client version, or one legal order covering several US-based providers, moves the majority in one step.
3. **It gives the attacker a price list.** Majority-of-five means "corrupt three." That's a budget, and budgets get met.

A vote scales your security with **how many** sources agree. A proof doesn't care how many agree.

With proofs, the security model inverts completely:

| | Voting | Proving |
|---|---|---|
| Need honest sources | a majority | **one** |
| If all sources lie | you're deceived | **you fail closed** |
| Attacker's job | corrupt the majority | break keccak256 |
| Can you detect a lie? | only if you're in the minority | **always** |

That last row is the whole thing. With proofs you need exactly **one** honest provider out of any number, because you're not counting opinions — you're checking arithmetic. And if you get *zero* honest providers, you don't get deceived, you get **nothing**, and NULLIUS tells you so.

That distinction has a name worth using out loud: **liveness degrades, safety doesn't.** Refusing to show a number is a worse user experience than showing one. Showing a false number is a worse *outcome*. We choose the worse experience every time, and we say so in the interface.

**Don't vote, verify.** That is the entire argument in three words.

---

## 5. Module one — `nullius/provider`

**What it is:** a drop-in replacement for the thing your wallet uses to talk to Ethereum.

There's a standard interface, **EIP-1193**, that every Ethereum app expects. Every library — viem, wagmi, ethers — lets you supply your own. So NULLIUS is not a new wallet you have to adopt; it's a component existing apps can accept.

**What it does, step by step:**

1. On startup, it syncs a light client in your browser and obtains a **verified state root**.
2. An app asks for something — say, a balance.
3. Instead of asking for the balance, NULLIUS asks for the **proof** (`eth_getProof`).
4. It asks several independent providers at once — not to vote, but for **speed and liveness**. The rule is: *the first response that verifies wins.* A provider returning garbage is simply ignored; a provider returning a valid proof is used regardless of what the others said.
5. It walks the proof locally: decode each node, hash it, check it against its parent, up to the root. Compare to the verified state root.
6. Match → the value is handed to the app labelled **PROVEN**. No match → **rejected**, loudly, and the provider is recorded as having lied.

**What it can prove:** balances, nonces, contract code, and any individual storage slot. Those all live directly in the state tree.

**What it can't prove (yet), and why:** `eth_call` — "run this contract function and tell me the answer" — isn't a lookup, it's a *computation*. There's no single leaf in the tree holding the answer. To verify it properly you must fetch proofs for every piece of state the computation touches and then **re-run the code yourself** in a local EVM. That's genuinely possible and we implement it for one path (ERC-20 `balanceOf`) to prove the technique works, and we document the general approach honestly. Gas estimation and log filters have the same shape.

**This is why the trust levels exist.** Every value in the interface carries one of three labels, and they are not decoration:

| Label | Meaning |
|---|---|
| **PROVEN** | Merkle-verified against a light-client-verified state root. Genuine as arithmetic. |
| **ATTESTED-BY-N** | N providers agreed. Not proof. Just agreement. |
| **UNVERIFIABLE** | One source, no proof available. This is a claim. |

Any interface that shows a number without telling you which of these it is, is showing you a claim dressed as a fact. Being explicit about what we can't prove is what makes the PROVEN label worth anything: it means something precisely because it isn't applied to everything.

**The demo:** we ship a deliberately malicious RPC server called `evil-rpc`. It's a transparent proxy that passes everything through untouched except one thing: it multiplies reported balances by 100.

Point a normal, well-built app at it — the app cheerfully renders **420 ETH**. Point NULLIUS at the same endpoint and it rejects the response with a proof failure and fails over to a provider whose answer verifies.

Both panels are on screen at once. The whole thesis is visible in about four seconds, and nobody who sees it forgets it.

---

## 6. Module two — `nullius/route`

This module is about the *other* direction: not "is what I'm told true?" but "can what I send actually get through?"

### How transactions really reach the chain now

This surprises people, so it's worth stating carefully.

When you send a transaction, it does **not** go straight into a block. Most Ethereum validators no longer build their own blocks. They outsource it, through a system called **proposer-builder separation** (in practice, `mev-boost`):

- **Builders** assemble candidate blocks out of available transactions, competing to make the most profitable one.
- **Relays** sit between builders and validators, passing blocks along.
- The **validator** picks the most profitable block offered and proposes it.

So whether your transaction gets included depends on decisions made by builders and relays — private companies — not by the validator you might imagine is serving you.

### Where censorship comes from

Some relays filter transactions involving sanctioned addresses. This is a real, documented, ongoing thing: certain relays will not pass along a block containing certain transactions.

This is usually **not** total censorship — some builders include everything, so a filtered transaction typically still lands eventually. But "eventually" is doing a lot of work in that sentence. In practice censorship shows up as **delay**, not exclusion: your transaction takes many extra blocks. And delay is much harder to notice than outright rejection, which is exactly why it goes unmeasured.

Two more things worth knowing:

- You currently have **no visibility** into any of this. You send a transaction and it either appears or doesn't. There is no receipt, no route, no timeline, no explanation.
- The protocol-level fix is being worked on: **inclusion lists** (the current design is called **FOCIL**) would let proposers force transactions in. It isn't live. Until it is, this is a client-side problem, which is where we live.

### What this module does

**The Censorship Radar.** Relays publish their own data — every relay runs a public API listing the payloads it delivered. We ingest that continuously across the major relays (Flashbots, bloXroute in both its filtering and non-filtering flavours, Agnostic, Ultra Sound, Aestus, Titan), cross-reference against what actually landed on chain, and compute live behaviour per relay and per builder.

The result is a measurement, not an opinion: *this relay delivered N payloads today and has never once included a transaction touching this contract.* Nobody puts this in front of a user.

**Multicast send.** When you send a transaction, NULLIUS doesn't drop it into one endpoint and hope. It submits to several routes at once — chosen by their *measured* behaviour, not their marketing — plus the public mempool.

**The Flight Recorder.** For every transaction you get a timeline: where it was submitted, when each route first acknowledged it, which routes went quiet, how many blocks passed, and finally which block included it — with a **Merkle proof that it's in that block's transaction tree**, checked against a light-client-verified header. Not "the explorer says it confirmed." Proven.

The demo scenario: the same transaction sent down two routes, one of which silently drops it, with the recorder showing exactly who dropped it and when. We ship a local censoring-builder simulator so the mechanism is reproducible on demand rather than dependent on catching a real event during judging.

---

## 7. Module three — `nullius/id`

**The problem this solves: Sybil resistance without identity.**

A **Sybil attack** is one person pretending to be many. It breaks anything that assumes one-person-one-voice: votes, airdrops, quotas, reputation.

The usual defences all demand you *identify yourself* — a passport, a phone number, a face scan, a social graph. Each is a privacy disaster, each excludes people who lack the credential, and each still gets farmed at scale.

**The alternative: make identities expensive instead of identified.**

You don't actually need to know *who* someone is. You need it to be **costly** for one person to be many. Holding ETH is costly. So: prove you hold at least some threshold of ETH, and reveal nothing else.

**How, precisely.** Remember that a Merkle proof convinces you an account has a given balance. Now put that verification *inside a zero-knowledge proof*.

A **zero-knowledge proof** lets you prove a statement is true while revealing nothing beyond the statement itself. The classic intuition: proving you know a maze's route by emerging from the far side, without ever showing the path you took.

Our circuit (written in **Noir**) proves exactly this statement:

> *"There exists an account in Ethereum's state tree at block B whose balance is at least T — and I control it."*

It reveals: the block, the threshold, and a **nullifier** — a one-way tag derived from the account and the context. It does **not** reveal: the address, the exact balance, or anything linkable to your other activity.

The nullifier is what makes it usable. It's deterministic, so the same account produces the same tag in the same context, meaning you can't vote twice. And it's one-way, so nobody can work backwards to the account.

An on-chain verifier contract checks the proof. The block is anchored either by `blockhash` for recent blocks, or via **EIP-4788** (which puts beacon block roots into the EVM) for historical ones.

**What you get:** a gate where every extra identity costs an attacker real capital, no user reveals anything, and nothing needs a central registry, an orb, or a government.

**The honest caveats:**

- **It's proof of holdings, not proof of personhood.** A whale can make many identities. It raises the cost per identity; it doesn't cap identities. That's a real and correct trade for many use cases, and a wrong one for others.
- **This is the hardest part of the build.** Verifying a Merkle-Patricia path requires computing keccak256 hashes *inside* the circuit, and keccak is notoriously expensive in ZK. If in-browser proving time is unacceptable, we ship a documented fallback: a Poseidon-hash Merkle tree of qualifying holders, built from proofs we verified, with its root published. Proving becomes trivial. The cost is that membership is a **snapshot** rather than proven live — and if we ship that, we say so plainly rather than letting anyone assume otherwise.

---

## 8. Module four — `nullius/quorum`

**The problem: letting a group agree on something, with no platform in the middle, no way to buy the outcome, and no need for anyone to expose themselves.**

Three properties, and they are separate. Conflating them is the most common mistake in this area.

**Property one: no platform.** Group membership and results live in a contract. There's no server that could go down, get pressured, or quietly alter a tally.

**Property two: anonymity.** We use **Semaphore**, a well-established ZK system. Each member registers a commitment into a Merkle tree. To signal, you prove in zero knowledge that you're *somewhere* in that tree, without revealing where. The signal is attributable to the group and to no member.

Semaphore also stops double-signalling: each proof emits a nullifier per topic, so one member gets one signal per topic while staying unlinkable across topics.

We add **RLN** (rate-limiting nullifiers) on top. Spam is normally handled by a moderator, which is another central party. RLN handles it with math: each member has a message quota, and exceeding it causes their secret to become recoverable — so over-posting gets you slashed automatically. No moderator exists to capture.

Membership is gated on `nullius/id` proofs. So the anonymity set isn't "whoever signed up" — it's *provably* "people holding at least T ETH", with no identities in it.

**Property three: collusion resistance — and this is where we're careful.**

**Anonymity is not the same as bribery resistance.** If I can *prove to you* how I voted, I can sell my vote — anonymity from the public doesn't stop me from voluntarily showing a briber my receipt.

The fix is **receipt-freeness**: make it impossible to prove how you voted, even if you want to. **MACI** (Minimal Anti-Collusion Infrastructure) is the known design, and its central trick is elegant: you can secretly **replace your voting key**. Any receipt you show a briber might have been invalidated by a later key change they can't detect. Your proof of how you voted becomes worthless, so the bribe market collapses.

MACI is a heavy integration for a 12-hour build. So we're direct about it: we ship Semaphore + RLN, implement the key-switching primitive minimally to demonstrate the mechanism, and **cite MACI as prior art rather than claiming to have solved collusion**.

Stating precisely why anonymity is not collusion resistance, and naming the design that is, is worth more than an overclaim that would not survive scrutiny.

---

## 9. What we do NOT prove

A system that catches a server lying only earns belief if it is equally precise about its own limits. All of this is on screen in the app, not only here.

- **The anchor.** The root comes from a block header corroborated across independent endpoints, not from a verified sync-committee signature. That is a *larger* assumption than running a light client, not a smaller one, because these are third parties. It is the biggest thing being trusted. Full light-client sync is the next step.
- **`eth_call` in the general case.** Implemented verifiably for one path to prove the technique. The rest is labelled UNVERIFIABLE — not quietly labelled PROVEN.
- **Gas estimation and log filters.** Same category. Marked, not hidden.
- **Censorship *intent*.** We measure behaviour. "This relay has never included this kind of transaction" is a measurement. *Why* is an inference, and we don't dress inference as data.
- **Personhood.** `nullius/id` proves capital, not humanity. Distinct things.
- **Zero-knowledge membership in the app.** The quorum's gate is proven, because every member's balance was demonstrated against the same root. Its anonymity is not proven *inside the app*: the Noir circuit exists and verifies, but it proves through the command line rather than in the browser, and the set it proves membership of is a snapshot rather than the live state trie.
- **Collusion resistance.** We have anonymity, which is a different property. See section 8.
- **Transaction inclusion.** The flight recorder's inclusion is reported, not proven. Proving it means rebuilding the block's transaction trie locally and checking its root against the header.

---

## 10. Common questions

**"How do you get the state root without trusting someone?"**
Sync committee signatures over beacon headers, verified locally. 512 validators rotating every ~27 hours, aggregate BLS signature, cheap enough for a browser. One trust assumption: the weak subjectivity checkpoint. We state it rather than hide it.

**"What if every provider refuses to serve proofs?"**
You get nothing, and we tell you that you got nothing. Liveness degrades; safety doesn't. That's strictly better than being lied to.

**"Isn't `eth_getProof` support inconsistent across providers?"**
Yes — and measuring exactly that is one of our outputs. We record which endpoints serve proofs, which serve them slowly, and which serve garbage.

**"Isn't this just a light client? Helios exists."**
A light client gives you verified headers. It doesn't give an application a verified *read path* with per-value trust labelling, a censorship-aware send path, or a ZK identity gate anchored to the same root. We use light-client machinery as the trust anchor and build the layer applications actually consume. Naming Helios ourselves is better than being told about it.

**"Is your voting actually collusion-resistant?"**
No. It's anonymous. Collusion resistance needs receipt-freeness, which needs key switching — that's MACI's insight, we cite it, we didn't rebuild it in 12 hours. (**Know this answer cold.** It's the single most likely question from someone who really knows the space, and answering it crisply is worth more than a module.)

**"How is the ZK holdings proof not just a snapshot?"**
Depends which path shipped. Plan A proves against the live state tree. Plan B uses a published snapshot root. Answer truthfully — check which one is running before you demo.

**"Why not just run your own node?"**
Great answer for one person, no answer for a browser, a phone, or a hundred million users. Verification has to be cheap enough to happen at the edge, or it doesn't happen.

**"What's actually new here?"**
None of the primitives. All of the assembly. EIP-1186 is from 2018, light clients have existed for years, Semaphore is mature. The gap is that nobody wired them into the path a user actually looks at. We did, and we can show you a server getting caught.

---

## 11. Glossary

| Term | Plain meaning |
|---|---|
| **Hash / keccak256** | A fingerprint of data. Can't be reversed, can't be faked to match a target. |
| **State root** | One hash summarising every Ethereum account at once. Sits in every block header. |
| **Merkle Patricia Trie** | The tree Ethereum stores accounts in. Its shape is what makes short proofs possible. |
| **Merkle proof** | The short chain of nodes and sibling hashes that lets you check one value against the root yourself. |
| **`eth_getProof`** | The RPC method that returns that proof. Standardised as EIP-1186 in 2018. |
| **EIP-1193** | The standard interface apps use to talk to Ethereum. Being able to swap it is why NULLIUS is adoptable. |
| **Light client** | Follows the chain by checking signatures instead of downloading and executing it. |
| **Sync committee** | 512 validators, rotating every ~27 hours, whose aggregated signature a light client verifies. |
| **Weak subjectivity checkpoint** | The one block you have to accept as real to start. Our only standing trust assumption. |
| **EIP-4788** | Puts beacon block roots into the EVM, so contracts can anchor claims to historical consensus. |
| **ERC-4337** | Account abstraction built *on top of* Ethereum, in contracts. Live today. |
| **EIP-8141** | "Frame Transaction" — account abstraction built *into* the protocol. A transaction becomes a sequence of frames: validate, authorise gas, execute. So an account can use any signature scheme and pay gas any way it likes. Draft, targeted at the Bogota fork. |
| **PBS / mev-boost** | Validators outsourcing block building to competing builders via relays. |
| **Relay** | The intermediary passing blocks from builders to validators. Some filter transactions. |
| **Builder** | Assembles candidate blocks from available transactions. |
| **Inclusion list / FOCIL** | Proposed protocol mechanism to force transactions into blocks. Not live yet. |
| **Zero-knowledge proof** | Proving a statement is true while revealing nothing else. |
| **Noir** | The language we write the ZK circuit in. |
| **Nullifier** | A one-way tag that stops reuse without revealing who you are. |
| **Poseidon** | A hash designed to be cheap inside ZK circuits (keccak is expensive there). |
| **Semaphore** | Established ZK system for anonymous membership and signalling. |
| **RLN** | Rate-limiting nullifiers — spam control by slashing instead of by moderator. |
| **MACI** | The anti-collusion design whose key insight is secret key switching, making vote receipts worthless. |
| **Receipt-freeness** | You *cannot* prove how you voted, even if you want to. What actually kills vote-buying. |
| **Sybil attack** | One person pretending to be many. |
| **Anvil fork** | A local chain seeded from real mainnet state. Real data, deterministic, offline-safe. |

---
