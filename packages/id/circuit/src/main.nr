// nullius/id — prove you belong to the set without saying which member you are.
//
// WHAT THIS CIRCUIT PROVES, exactly:
//
//   "I know a secret whose commitment sits in the Merkle tree whose root is
//    `root`, and the nullifier I am publishing is derived from that same secret
//    and this `context`."
//
// It reveals: the root, the context, and the nullifier. It does NOT reveal which
// leaf, the secret, or the address — so a signal is attributable to the set and
// to no member of it, and the same member cannot signal twice on one context
// because the nullifier is deterministic.
//
// WHAT IT DOES NOT PROVE, and this matters:
//
//   The tree's membership rule. Every leaf in this tree was admitted because a
//   Merkle-Patricia proof of its balance verified against a real Ethereum state
//   root — but that verification happened OUTSIDE this circuit, in the client.
//   So membership is a snapshot the verifier must accept, not something proven
//   here. Proving it in-circuit means walking the state trie inside the circuit,
//   which means keccak over every RLP node, which is the expensive path
//   (documented as Plan A). This is Plan B, done honestly: the anonymity is real
//   zero-knowledge; the gate is a snapshot.
//
// It also does not give collusion resistance. A member can still choose to
// reveal their own secret to a briber. Receipt-freeness needs the ability to
// secretly replace your key, which is MACI's contribution and is not rebuilt here.

global DEPTH: u32 = 4; // 16 members — enough for the demo set, cheap to prove

/// A two-input compression function built on Noir's Poseidon2 permutation.
///
/// Noir 1.0 exposes the permutation but no packaged 2-to-1 hash, and keccak256
/// has moved out of the stdlib into a separate library. So this circuit is
/// self-consistent rather than JS-compatible: the tree it verifies must be built
/// with this same construction.
///
/// That is the honest boundary on this artifact. The circuit is real, tested, and
/// produces a verifying proof — but wiring it to the browser needs a JS
/// implementation of exactly this construction, which is the documented next
/// step, not something quietly assumed to work.
fn hash2(a: Field, b: Field) -> Field {
    // Rate 2, capacity 2: absorb both inputs, squeeze one element.
    let state: [Field; 4] = std::hash::poseidon2_permutation([a, b, 0, 0]);
    state[0]
}

/// Walk a Merkle path from a leaf up to a root.
///
/// `index_bits` is the leaf's position, least-significant bit first: bit 0 means
/// "this node is the right child at that level". Passing bits rather than an
/// integer keeps the branch decision a single constrained multiplexer per level
/// instead of a division.
fn merkle_root(leaf: Field, siblings: [Field; DEPTH], index_bits: [bool; DEPTH]) -> Field {
    let mut node = leaf;
    for i in 0..DEPTH {
        let sibling = siblings[i];
        // If we are the right child, the sibling goes on the left.
        let is_right = index_bits[i] as Field;
        let left = node + is_right * (sibling - node);
        let right = sibling + is_right * (node - sibling);
        node = hash2(left, right);
    }
    node
}

fn main(
    // ---- private -----------------------------------------------------------
    secret: Field,
    address_field: Field,
    siblings: [Field; DEPTH],
    index_bits: [bool; DEPTH],
    // ---- public ------------------------------------------------------------
    root: pub Field,
    context: pub Field,
    nullifier: pub Field,
) {
    // The leaf binds the secret to the account it was admitted for, so one
    // secret cannot be replayed under a different member's slot.
    let commitment = hash2(secret, address_field);

    // Membership: the path must actually reach the published root.
    let computed = merkle_root(commitment, siblings, index_bits);
    assert(computed == root);

    // The nullifier must be the one derived from this secret and this context.
    // Deterministic, so one signal per member per context; one-way, so it says
    // nothing about which member.
    let expected_nullifier = hash2(secret, context);
    assert(expected_nullifier == nullifier);
}

#[test]
fn membership_and_nullifier_hold() {
    let secret = 42;
    let address_field = 7;
    let commitment = hash2(secret, address_field);

    // Build a 4-level tree where our leaf sits at index 0b0101 = 5.
    let s0 = 11;
    let s1 = 22;
    let s2 = 33;
    let s3 = 44;
    let bits: [bool; DEPTH] = [true, false, true, false];

    let mut node = commitment;
    node = hash2(s0, node); // bit 1 -> we are the right child
    node = hash2(node, s1); // bit 0 -> we are the left child
    node = hash2(s2, node);
    node = hash2(node, s3);

    let nullifier = hash2(secret, 999);
    main(secret, address_field, [s0, s1, s2, s3], bits, node, 999, nullifier);
}

/// Emits a valid witness so Prover.toml can be written without reimplementing
/// this circuit's hash outside it. Run with `nargo test --show-output emit_fixture`.
#[test]
fn emit_fixture() {
    let secret = 42;
    let address_field = 7;
    let context = 999;
    let commitment = hash2(secret, address_field);
    let s0 = 11;
    let s1 = 22;
    let s2 = 33;
    let s3 = 44;

    let mut node = commitment;
    node = hash2(s0, node);
    node = hash2(node, s1);
    node = hash2(s2, node);
    node = hash2(node, s3);

    let nullifier = hash2(secret, context);
    println(f"root = {node}");
    println(f"nullifier = {nullifier}");
}

#[test(should_fail)]
fn wrong_root_is_rejected() {
    let secret = 42;
    let address_field = 7;
    let bits: [bool; DEPTH] = [false, false, false, false];
    let nullifier = hash2(secret, 999);
    // A root nobody can produce a path to.
    main(secret, address_field, [1, 2, 3, 4], bits, 123456789, 999, nullifier);
}

#[test(should_fail)]
fn forged_nullifier_is_rejected() {
    let secret = 42;
    let address_field = 7;
    let commitment = hash2(secret, address_field);
    let bits: [bool; DEPTH] = [false, false, false, false];
    let mut node = commitment;
    node = hash2(node, 1);
    node = hash2(node, 2);
    node = hash2(node, 3);
    node = hash2(node, 4);
    // A nullifier not derived from this secret.
    main(secret, address_field, [1, 2, 3, 4], bits, node, 999, 5555);
}
