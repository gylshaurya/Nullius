import { useEffect, useRef } from 'react';

/**
 * The ground the console sits on: trie geometry, drawn once and drifted.
 *
 * This is the world's material, so it is generated rather than decorated — the
 * branching factor, depth, and fan are the real ones. It is deliberately dim and
 * deliberately cheap: rendered once into an offscreen canvas, then blitted with
 * a slow parallax translate, so the cost is one draw and a transform per frame
 * rather than thousands of paths every frame.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paint(target: HTMLCanvasElement, w: number, h: number, dpr: number) {
  const ctx = target.getContext('2d');
  if (!ctx) return;
  target.width = Math.ceil(w * dpr);
  target.height = Math.ceil(h * dpr);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const rand = mulberry32(0x9ea7);
  const levels = 7;
  const rowH = h / (levels + 1);

  type Node = { x: number; y: number };
  let row: Node[] = [{ x: w / 2, y: rowH * 0.35 }];

  ctx.lineWidth = 1;

  for (let depth = 1; depth <= levels; depth++) {
    const next: Node[] = [];
    const y = rowH * 0.35 + depth * rowH;
    // Fan is capped so the field stays legible; the structure it stands for is
    // 16-way, and the walk view shows all sixteen slots honestly.
    const fan = depth < 3 ? 4 : depth < 5 ? 3 : 2;
    const spread = w / Math.pow(2.05, depth) / 1.6;

    for (const parent of row) {
      for (let k = 0; k < fan; k++) {
        const t = k / (fan - 1);
        const jitter = (rand() - 0.5) * spread * 0.55;
        const x = parent.x + (t - 0.5) * spread * 2 + jitter;
        if (x < -w * 0.15 || x > w * 1.15) continue;
        const child = { x, y };
        next.push(child);

        const alpha = 0.075 - depth * 0.007;
        ctx.strokeStyle = `rgba(196, 200, 235, ${Math.max(alpha, 0.014)})`;
        ctx.beginPath();
        ctx.moveTo(parent.x, parent.y);
        // Slight curve so the field reads as structure, not as a starburst.
        const midY = (parent.y + y) / 2;
        ctx.bezierCurveTo(parent.x, midY, x, midY, x, y);
        ctx.stroke();
      }
    }

    for (const node of next) {
      const lit = rand() < 0.045;
      ctx.fillStyle = lit
        ? 'rgba(223, 255, 55, 0.16)'
        : `rgba(196, 200, 235, ${Math.max(0.09 - depth * 0.008, 0.02)})`;
      const r = lit ? 1.6 : 1.05;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    row = next;
    if (row.length > 900) row = row.slice(0, 900);
  }
}

export function TrieGround() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let raf = 0;
    let disposed = false;

    const render = () => {
      const w = window.innerWidth;
      const h = Math.max(window.innerHeight * 1.35, 900);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      paint(canvas, w, h, dpr);
    };

    render();
    const onResize = () => render();
    window.addEventListener('resize', onResize);

    if (!reduce) {
      const start = performance.now();
      const tick = () => {
        if (disposed) return;
        const t = (performance.now() - start) / 1000;
        // 90 second cycle, a few pixels of travel. Present, never noticed.
        const y = Math.sin((t / 90) * Math.PI * 2) * 10 - 12;
        const x = Math.cos((t / 130) * Math.PI * 2) * 6;
        canvas.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas className="ground" ref={ref} aria-hidden="true" />;
}
