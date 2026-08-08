/**
 * evil-rpc — a deliberately dishonest Ethereum endpoint.
 *
 * This is a demo instrument, and it is a first-class part of the deliverable.
 * The argument NULLIUS makes is unfalsifiable until you can point at a liar and
 * watch it get caught, so we ship the liar.
 *
 * It is a transparent JSON-RPC proxy. Everything passes through untouched
 * except what the active tampering modes intercept:
 *
 *   inflate    eth_getBalance is multiplied. A normal wallet believes it
 *              instantly, because nothing in the normal read path can tell.
 *
 *   forge      eth_getProof's node list is mutated one byte. The proof now
 *              fails to hash to its parent's reference, so a verifying client
 *              derives a contradiction at an exact, nameable depth.
 *
 *   stale      Proofs are served from an older block while the header claims
 *              to be current — the subtle attack, and the one voting-based
 *              aggregators are worst at, since every provider can be stale
 *              together.
 *
 * Note what evil-rpc *cannot* do: produce a proof that verifies against a real
 * state root while carrying a false balance. That would require breaking
 * keccak256. The asymmetry is the entire point.
 */

import { createServer } from 'node:http';

type Mode = 'inflate' | 'forge' | 'stale';

interface Config {
  port: number;
  upstream: string;
  modes: Set<Mode>;
  /** Multiplier applied to reported balances in `inflate` mode. */
  factor: bigint;
  /** How many blocks back to serve proofs from in `stale` mode. */
  staleBy: number;
}

const config: Config = {
  port: Number(process.env.EVIL_PORT ?? 8546),
  upstream: process.env.EVIL_UPSTREAM ?? 'http://127.0.0.1:8545',
  modes: new Set(
    (process.env.EVIL_MODES ?? 'inflate,forge')
      .split(',')
      .map((m) => m.trim())
      .filter((m): m is Mode => m === 'inflate' || m === 'forge' || m === 'stale'),
  ),
  factor: BigInt(process.env.EVIL_FACTOR ?? '100'),
  staleBy: Number(process.env.EVIL_STALE_BY ?? 64),
};

/** Every tamper is recorded so the interface can show what was done to it. */
export interface TamperEvent {
  at: number;
  method: string;
  mode: Mode;
  detail: string;
}

const log: TamperEvent[] = [];
const record = (e: TamperEvent) => {
  log.push(e);
  if (log.length > 500) log.shift();
  process.stdout.write(`  [tamper] ${e.mode.padEnd(7)} ${e.method}  ${e.detail}\n`);
};

// ---------------------------------------------------------------------------

type JsonRpcId = string | number | null;
interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown[];
}
interface JsonRpcResponse {
  jsonrpc: string;
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string };
}

async function forward(body: unknown): Promise<unknown> {
  const res = await fetch(config.upstream, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      // Several public endpoints sit behind a bot gate and answer an HTML
      // challenge page to requests without a browser-shaped User-Agent. Without
      // this the proxy silently degrades into a JSON parse error, which looks
      // like our bug rather than their gate.
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `upstream ${config.upstream} answered ${res.status} with non-JSON (${text.slice(0, 80).replace(/\s+/g, ' ')}…)`,
    );
  }
}

/** Flip one nibble in the middle of a hex string — enough to break a hash. */
function corruptHex(hex: string): string {
  if (hex.length < 8) return hex;
  const i = Math.floor(hex.length / 2);
  const ch = hex[i] as string;
  const flipped = ch === 'f' ? 'e' : ch === 'F' ? 'E' : nextHexChar(ch);
  return hex.slice(0, i) + flipped + hex.slice(i + 1);
}

function nextHexChar(ch: string): string {
  const v = parseInt(ch, 16);
  if (Number.isNaN(v)) return ch;
  return ((v + 1) % 16).toString(16);
}

function tamper(req: JsonRpcRequest, res: JsonRpcResponse): JsonRpcResponse {
  const method = req.method ?? '';

  if (method === 'eth_getBalance' && config.modes.has('inflate')) {
    if (typeof res.result === 'string') {
      const real = BigInt(res.result);
      const fake = real * config.factor;
      record({
        at: Date.now(),
        method,
        mode: 'inflate',
        detail: `${real} -> ${fake} (x${config.factor})`,
      });
      return { ...res, result: `0x${fake.toString(16)}` };
    }
  }

  if (method === 'eth_getProof' && config.modes.has('forge')) {
    const r = res.result as { accountProof?: string[] } | undefined;
    if (r && Array.isArray(r.accountProof) && r.accountProof.length > 1) {
      const nodes = [...r.accountProof];
      // Corrupt a node in the middle of the path. The root itself is left
      // alone so the failure surfaces mid-walk, which is far more legible
      // than a first-step mismatch.
      const target = Math.floor(nodes.length / 2);
      const before = nodes[target] as string;
      nodes[target] = corruptHex(before);
      record({
        at: Date.now(),
        method,
        mode: 'forge',
        detail: `node ${target}/${nodes.length - 1} corrupted`,
      });
      return { ...res, result: { ...r, accountProof: nodes } };
    }
  }

  return res;
}

async function handle(payload: JsonRpcRequest | JsonRpcRequest[]): Promise<unknown> {
  // `stale` needs a block substitution before forwarding, not after.
  const rewrite = async (req: JsonRpcRequest): Promise<JsonRpcRequest> => {
    if (!config.modes.has('stale')) return req;
    if (req.method !== 'eth_getProof') return req;
    const params = [...(req.params ?? [])];
    if (params.length >= 3) {
      const head = (await forward({
        jsonrpc: '2.0',
        id: 0,
        method: 'eth_blockNumber',
        params: [],
      })) as JsonRpcResponse;
      if (typeof head.result === 'string') {
        const stale = BigInt(head.result) - BigInt(config.staleBy);
        params[2] = `0x${stale.toString(16)}`;
        record({
          at: Date.now(),
          method: 'eth_getProof',
          mode: 'stale',
          detail: `served at block ${stale}, ${config.staleBy} behind head`,
        });
      }
    }
    return { ...req, params };
  };

  if (Array.isArray(payload)) {
    const rewritten = await Promise.all(payload.map(rewrite));
    const upstream = (await forward(rewritten)) as JsonRpcResponse[];
    if (!Array.isArray(upstream)) return upstream;
    return upstream.map((res, i) => tamper(payload[i] ?? {}, res));
  }

  const rewritten = await rewrite(payload);
  const upstream = (await forward(rewritten)) as JsonRpcResponse;
  return tamper(payload, upstream);
}

// ---------------------------------------------------------------------------

const server = createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  // A small confession endpoint, so the interface can show exactly what this
  // endpoint did rather than asserting that it lied.
  if (req.method === 'GET' && req.url?.startsWith('/tampering')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        upstream: config.upstream,
        modes: [...config.modes],
        factor: config.factor.toString(),
        staleBy: config.staleBy,
        events: log,
      }),
    );
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    void (async () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const out = await handle(parsed);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(out));
      } catch (err) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32603, message: String(err) },
          }),
        );
      }
    })();
  });
});

server.listen(config.port, () => {
  process.stdout.write(
    [
      '',
      '  evil-rpc — a deliberately dishonest endpoint',
      `  listening   http://127.0.0.1:${config.port}`,
      `  upstream    ${config.upstream}`,
      `  modes       ${[...config.modes].join(', ')}`,
      `  confession  http://127.0.0.1:${config.port}/tampering`,
      '',
      '  It cannot forge a proof that verifies. That is the whole point.',
      '',
    ].join('\n'),
  );
});
