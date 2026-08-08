import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Relay data APIs send no CORS headers, so the dev server proxies them.
 * This is a transport detail, not a trust boundary: relay data is self-reported
 * either way, which is why the radar labels it reported and never proven.
 */
const RELAY_UPSTREAM: Record<string, string> = {
  flashbots: 'https://boost-relay.flashbots.net',
  'bloxroute-regulated': 'https://bloxroute.regulated.blxrbdn.com',
  'bloxroute-max-profit': 'https://bloxroute.max-profit.blxrbdn.com',
  agnostic: 'https://agnostic-relay.net',
  ultrasound: 'https://relay.ultrasound.money',
  aestus: 'https://mainnet.aestus.live',
  titan: 'https://titanrelay.xyz',
};

const relayProxies = Object.fromEntries(
  Object.entries(RELAY_UPSTREAM).map(([id, target]) => [
    `/relay/${id}`,
    {
      target,
      changeOrigin: true,
      secure: true,
      rewrite: (path: string) => path.replace(`/relay/${id}`, ''),
    },
  ]),
);

export default defineConfig({
  // A GitHub Pages project site serves from /<repo>/, so asset and link URLs
  // need that prefix. Left as '/' for local dev and root-domain hosts.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: {
    proxy: relayProxies,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        // The console is the product; the pitch is the surface that argues for it.
        console: resolve(__dirname, 'index.html'),
        pitch: resolve(__dirname, 'pitch.html'),
      },
    },
  },
});
