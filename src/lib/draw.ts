import { Pt } from "./geometry";

export type ArcTone = "volt" | "amber" | "coral" | "mist";

const TONES: Record<ArcTone, string> = {
  volt: "#c6f235",
  amber: "#ffb454",
  coral: "#ff5d49",
  mist: "#aab7c2",
};

const LEFT_IDS = new Set([11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]);
const RIGHT_IDS = new Set([12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]);

const BONES: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [15, 17], [15, 19], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [18, 20],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

export interface DrawOpts {
  lm: Pt[] | null;
  w: number;
  h: number;
  t: number;
  tracking: boolean;
  /** joint index where the live angle arc is drawn (knee / elbow), if any */
  arc: { joint: [number, number, number]; angle: number; tone: ArcTone; label: string } | null;
  /** dashed alignment line a→c with measured point p (plank / push-up body line) */
  align: { a: number; c: number; p: number; dev: number } | null;
  trail: { x: number; y: number }[];
  keyJoints: number[];
  issueActive: boolean;
}

function boneColor(idA: number, idB: number): string {
  if (LEFT_IDS.has(idA) && LEFT_IDS.has(idB)) return "#c6f235";
  if (RIGHT_IDS.has(idA) && RIGHT_IDS.has(idB)) return "#5fe0f7";
  return "#e9efea";
}

export function drawScene(ctx: CanvasRenderingContext2D, o: DrawOpts) {
  const { w, h } = o;
  ctx.clearRect(0, 0, w, h);
  if (!o.lm || !o.tracking) return;

  ctx.save();
  // selfie mirror
  ctx.translate(w, 0);
  ctx.scale(-1, 1);

  const px = (i: number) => o.lm![i].x * w;
  const py = (i: number) => o.lm![i].y * h;
  const vis = (i: number) => o.lm![i].visibility ?? 0;

  // ---- motion trail ----
  const n = o.trail.length;
  for (let i = 0; i < n; i++) {
    const f = (i + 1) / n;
    ctx.beginPath();
    ctx.arc(o.trail[i].x * w, o.trail[i].y * h, 2 + f * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(198,242,53,${f * 0.32})`;
    ctx.fill();
  }

  // ---- alignment guide (plank / push-up) ----
  if (o.align) {
    const { a, c, p, dev } = o.align;
    if (vis(a) > 0.4 && vis(c) > 0.4) {
      const good = Math.abs(dev) < 0.12;
      ctx.save();
      ctx.setLineDash([7, 8]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = good ? "rgba(198,242,53,0.75)" : "rgba(255,93,73,0.85)";
      ctx.beginPath();
      ctx.moveTo(px(a), py(a));
      ctx.lineTo(px(c), py(c));
      ctx.stroke();
      ctx.setLineDash([]);
      // hip marker + deviation tick
      if (vis(p) > 0.4) {
        ctx.beginPath();
        ctx.arc(px(p), py(p), 6, 0, Math.PI * 2);
        ctx.strokeStyle = good ? "#c6f235" : "#ff5d49";
        ctx.lineWidth = 2;
        ctx.stroke();
        // project hip onto the line to draw the deviation segment
        const ax = px(a), ay = py(a), cx = px(c), cy = py(c);
        const dx = cx - ax, dy = cy - ay;
        const len2 = dx * dx + dy * dy || 1;
        const tt = ((px(p) - ax) * dx + (py(p) - ay) * dy) / len2;
        const fx = ax + tt * dx, fy = ay + tt * dy;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(px(p), py(p));
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---- bones, two-pass glow ----
  for (const pass of [0, 1] as const) {
    ctx.lineWidth = pass === 0 ? 10 : 3.4;
    ctx.lineCap = "round";
    for (const [a, b] of BONES) {
      const v = Math.min(vis(a), vis(b));
      if (v < 0.35) continue;
      const col = boneColor(a, b);
      ctx.globalAlpha = (pass === 0 ? 0.14 : 0.95) * (0.45 + 0.55 * v);
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(px(a), py(a));
      ctx.lineTo(px(b), py(b));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // ---- head ----
  if (vis(0) > 0.4 && (vis(7) > 0.3 || vis(8) > 0.3)) {
    const ear = vis(7) > vis(8) ? 7 : 8;
    const r = Math.max(16, Math.hypot(px(0) - px(ear), py(0) - py(ear)) * 1.25);
    ctx.beginPath();
    ctx.ellipse(px(0), py(0) - r * 0.1, r * 0.82, r, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(233,239,234,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ---- joints ----
  const keySet = new Set(o.keyJoints);
  for (let i = 11; i <= 32; i++) {
    const v = vis(i);
    if (v < 0.35) continue;
    const x = px(i), y = py(i);
    const isKey = keySet.has(i);
    const col = LEFT_IDS.has(i) ? "#c6f235" : RIGHT_IDS.has(i) ? "#5fe0f7" : "#e9efea";

    if (isKey) {
      const pulse = 12 + 5 * Math.sin(o.t / 220);
      ctx.beginPath();
      ctx.arc(x, y, pulse, 0, Math.PI * 2);
      ctx.strokeStyle = o.issueActive ? "rgba(255,93,73,0.55)" : "rgba(198,242,53,0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, isKey ? 6.5 : 4.2, 0, Math.PI * 2);
    ctx.fillStyle = "#0b0e11";
    ctx.fill();
    ctx.lineWidth = isKey ? 2.6 : 2;
    ctx.strokeStyle = col;
    ctx.stroke();
  }

  // ---- live angle arc ----
  if (o.arc) {
    const [A, B, C] = o.arc.joint;
    if (vis(A) > 0.4 && vis(B) > 0.4 && vis(C) > 0.4) {
      const bx = px(B), by = py(B);
      const a1 = Math.atan2(py(A) - by, px(A) - bx);
      const a2 = Math.atan2(py(C) - by, px(C) - bx);
      let diff = a2 - a1;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const R = 30;
      const tone = TONES[o.arc.tone];
      ctx.beginPath();
      ctx.arc(bx, by, R, a1, a1 + diff, diff < 0);
      ctx.strokeStyle = tone;
      ctx.lineWidth = 3;
      ctx.stroke();
      // wedge fill
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.arc(bx, by, R, a1, a1 + diff, diff < 0);
      ctx.closePath();
      ctx.fillStyle = hexA(tone, 0.13);
      ctx.fill();
      // label
      const mid = a1 + diff / 2;
      const lx = bx + Math.cos(mid) * (R + 22);
      const ly = by + Math.sin(mid) * (R + 22);
      ctx.font = "700 13px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#0b0e11";
      ctx.strokeStyle = "#0b0e11";
      ctx.lineWidth = 4;
      ctx.strokeText(o.arc.label, lx, ly);
      ctx.fillStyle = tone;
      ctx.fillText(o.arc.label, lx, ly);
    }
  }

  ctx.restore();
}

function hexA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
