/**
 * Capture a relay measurement snapshot for static deployments.
 *
 * A browser cannot reach relay data APIs (they send no CORS headers), and a
 * static host has no proxy to do it for them. So the deployed build falls back
 * to the file this writes. It runs the exact same counting code the live radar
 * uses, rather than a second implementation that could drift from it, and it
 * stamps the capture time so the interface can say the numbers are stored.
 *
 *   pnpm relay:snapshot
 */

import { writeFile } from 'node:fs/promises';
import { RELAYS, observeRelays } from '../packages/route/src/index.ts';

const UPSTREAM: Record<string, string> = {
  flashbots: 'https://boost-relay.flashbots.net',
  'bloxroute-regulated': 'https://bloxroute.regulated.blxrbdn.com',
  'bloxroute-max-profit': 'https://bloxroute.max-profit.blxrbdn.com',
  agnostic: 'https://agnostic-relay.net',
  ultrasound: 'https://relay.ultrasound.money',
  aestus: 'https://mainnet.aestus.live',
  titan: 'https://titanrelay.xyz',
};

const out = 'apps/web/public/relay-snapshot.json';

const observations = await observeRelays({
  limit: 200,
  timeoutMs: 15000,
  relays: RELAYS.map((r) => ({ ...r, dataApi: UPSTREAM[r.id] ?? r.dataApi })),
});

const answered = observations.filter((o) => !o.error);
if (answered.length === 0) {
  console.error('no relay answered; refusing to write an empty snapshot');
  process.exit(1);
}

const payload = {
  capturedAt: Date.now(),
  rows: observations.map((o) => ({
    ...o,
    lastSeenSlot: o.lastSeenSlot === null ? null : o.lastSeenSlot.toString(),
  })),
};

await writeFile(out, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`wrote ${out}`);
console.log(`  ${answered.length}/${observations.length} relays answered`);
for (const o of answered.sort((a, b) => b.payloadsDelivered - a.payloadsDelivered)) {
  console.log(
    `  ${o.relay.label.padEnd(22)} ${String(o.payloadsDelivered).padStart(5)} payloads  ${(o.share * 100).toFixed(1)}%`,
  );
}
