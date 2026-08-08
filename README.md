# Nullius

**Your wallet has never once checked. Nullius makes it check.**

When your wallet shows you a balance, that number came from a company. Your wallet asked a server, the server answered, and your wallet drew the answer on the screen. No signature, no proof, no check. A truthful answer and a forged one are byte identical from your wallet's point of view, which is why no wallet has ever caught one.

Nullius asks for a cryptographic proof instead and checks it in your browser. When a server lies, you see it happen, and you see the exact node where the lie broke.

Ethereum has supported this since 2018. Almost nobody uses it.

---

## The architecture

![Architecture diagram](apps/web/public/architecture.svg)

**The top band** is what happens today. Your wallet asks a provider with `eth_getBalance`, the provider replies with the string `"4.2"`, your screen says `4.2 ETH`. The arrows are dashed because nothing in that path carries any evidence.

**The bottom band** is what Nullius does, reading left to right:

- **Your wallet, unchanged.** It keeps speaking EIP-1193, the interface viem and wagmi and ethers already use.
- **`nullius/provider`** (ultramarine) replaces the ordinary connection and upgrades the question from "what is the balance" to "prove the balance".
- **Three endpoints, fanned out.** Two independent operators plus `evil-rpc`, outlined in red because it lies on purpose. They are asked in parallel for speed and liveness, **not** so a vote can be held between them.
- **The local Merkle walk** (citron) is where every proof lands. Each node is hashed and checked against the reference its parent holds, in your browser, not on a server. This is the only place in the diagram where belief is created.
- **The trust boundary** is the dashed red box. Inside it sits the anchored state root, the one thing still trusted. Everything above it is verified. The app names that assumption permanently on screen rather than hiding it.
- **Three outcomes:** *Proven*, where the first proof that verifies wins and one honest endpoint is enough. *Rejected*, where a proof was offered and its hashes do not reach the root, naming the node it broke at. *Zero honest*, where you get nothing rather than a lie.

In one sentence: belief is created in exactly one place, on your machine, by comparing hashes against a root you obtained independently.

---

## How it works

Every block header contains a **state root**, a single hash that fingerprints every account on Ethereum at once, because each node in Ethereum's account tree is identified by a hash of its contents and every parent holds the identities of its children. Change one balance anywhere and the root changes.

So a server can prove one account without sending the whole tree. It sends the path: the nodes from the top down to your account, plus the siblings along the way. You hash the account, check that hash appears in its parent, hash the parent, and walk up until you reach the root you already trust. If it matches, the data is genuine in the same way two plus two is four. If not, the server lied. Forging it means breaking keccak256.

This is `eth_getProof`, standardised as EIP-1186.

### Why not ask five servers and take the majority?

Because a vote is weaker than a proof, and this is the decision the project rests on.

Many "different" endpoints resell access to the same few backends, so polling five sources is often polling one source five times. They can be wrong together, since one bug in a popular client or one legal order covering several companies moves the majority in a single step. And a majority of five means corrupting three, which is a price rather than a barrier.

| | Polling providers | Verifying a proof |
|---|---|---|
| Honest sources needed | a majority | exactly one |
| If every source lies | you are deceived, silently | you get nothing, loudly |
| The attacker's job | corrupt the majority | break keccak256 |
| Can you detect a lie? | only from the minority | always, and name the node |

Liveness degrades. Safety does not.

---

## What you can do with it

**Read Ethereum without trusting the company that answers.** Balances, nonces, contract code and storage become values you verify yourself. One honest endpoint out of any number is enough.

**Tell when an endpoint is lying.** Nullius rejects proofs that do not hash to the root and names the node where each one failed. It also records which endpoints refuse to serve proofs at all, which turns out to include some popular ones: `publicnode` and `merkle.io` both refused or throttled the request during this build.

**See whether your transaction can get through.** Most validators no longer build their own blocks; builders and relays do, and some relays filter what they carry. Nullius reads the relays' own public feeds, counts what each delivered over a window they can all see, and shows the share of Ethereum's block supply flowing through relays that filter. Then it broadcasts one signed transaction across several routes and records which route went quiet, so silent censorship becomes visible.

**Prove group membership without identifying yourself.** Membership is gated on proven ETH holdings rather than a passport or a phone number, so an extra identity costs capital instead of privacy, and no registry exists to be leaked.

**Drop it into an existing app.** It implements EIP-1193, so existing libraries accept it without a rewrite.

---

## Four levels of trust

Every value carries one of these, drawn as four shapes rather than four colours, so the difference survives a black and white screenshot.

| Level | Meaning |
|---|---|
| **Proven** | Merkle verified against the anchored state root. Genuine as arithmetic. |
| **Attested** | Endpoints agree, no proof offered. Agreement is not proof. |
| **Unverifiable** | One source, no proof obtainable. This is a claim. |
| **Rejected** | A proof was offered and its hashes do not reach the root. |

A bar across the top of the app lists everything the system does not prove, permanently. A system that catches a server lying only earns belief if it is equally precise about its own limits.

---

## The modules

**provider** anchors a state root, upgrades reads into `eth_getProof`, and walks the Merkle Patricia path locally. It refuses endpoints answering for the wrong chain, and picks the anchor as the highest block at least two independent endpoints claim to have, so no single endpoint can choose the root by misreporting its height.

**route** measures relay behaviour from the relays' own feeds and multicasts one signed transaction across several routes so you can see which went silent.

**id** is a Noir circuit for anonymous membership: it proves you know a secret whose commitment sits in a published tree, and that your nullifier came from that same secret, without revealing which member you are. 481 gates, and the proof verifies.

**quorum** is group signalling gated on proven holdings rather than identity.

**evil-rpc** is a deliberately dishonest endpoint, shipped as part of the project rather than as a test fixture. It reports balances a hundred times too large and corrupts one node of every account proof. The argument here is untestable until you can watch a liar get caught, so the liar ships with it.

Note what it cannot do: produce a proof that verifies while carrying a false balance. That would mean breaking keccak256, and that asymmetry is the whole idea.

---

## Running it

Needs Node 20 or newer and pnpm.

```bash
pnpm install
EVIL_UPSTREAM=https://eth.drpc.org pnpm evil    # the dishonest endpoint
pnpm dev                                         # the app
```

| Open this | To see |
|---|---|
| `http://localhost:5180/pitch.html` | a live verification against real mainnet, in the first screen |
| `http://localhost:5180/?show=rejected` | a forged proof, rejected at the node where it broke |
| `http://localhost:5180/` | the full console |

Ask the dishonest endpoint what it faked with `curl http://127.0.0.1:8546/tampering`.

Reads go to two independent public mainnet endpoints plus the dishonest one, so the proofs are real mainnet proofs and the root is corroborated across operators who do not share a backend. Relay APIs send no CORS headers, so the dev server proxies them. For the flight recorder's send path, which needs a funded account, also run `anvil --fork-url https://eth.drpc.org --port 8545 --chain-id 1`.

Endpoints are overridable with a `.env` in `apps/web`: `VITE_RPC_A`, `VITE_RPC_B`, `VITE_EVIL_RPC`, `VITE_FORK_RPC`.

### Layout

```
packages/types      the shared interface contract
packages/provider   state root anchoring, eth_getProof, the Merkle verifier
packages/route      censorship radar, multicast sender, flight recorder
packages/id         the Noir circuit
apps/web            the console and the project page
apps/evil-rpc       the deliberately dishonest endpoint
```

`packages/provider/src/mpt.ts` is the file the project rests on. Everything else is arrangement, and it is written to be read.

### The circuit

Needs `nargo` and `bb`, via `noirup` and `bbup`.

```bash
pnpm --filter @nullius/id all
```

Runs the tests, compiles, solves the witness, writes a verification key, proves, and verifies. 3 tests pass, 2 of them negative, at 481 gates and 29 ACIR opcodes, producing a 14,656 byte UltraHonk proof. The negative tests are the interesting ones: one shows a path to an unreachable root is refused, the other shows a nullifier not derived from the secret is refused. You can also flip a byte of `target/public_inputs` and watch verification fail.

---

`EXPLAINER.md` has the whole system in plain words, with a glossary. `packages/id/README.md` covers what the circuit proves and what it does not.

*The name is from* nullius in verba, *Latin for "take nobody's word for it", the motto the Royal Society adopted in 1660.*
