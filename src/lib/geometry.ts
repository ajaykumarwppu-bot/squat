export interface Pt {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** Angle in degrees at vertex b, formed by segments b->a and b->c. */
export function angleDeg(a: Pt, b: Pt, c: Pt): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 < 1e-6 || m2 < 1e-6) return 180;
  const dot = v1x * v2x + v1y * v2y;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Signed vertical deviation of point p from the line a->c, evaluated at p.x,
 * normalized by the segment length of a->c. Positive = p is BELOW the line
 * (image coords, y grows downward) → "sag". Negative = above → "pike".
 */
export function sagDeviation(a: Pt, c: Pt, p: Pt): number {
  const dx = c.x - a.x;
  const len = Math.hypot(dx, c.y - a.y) || 1e-6;
  let lineY: number;
  if (Math.abs(dx) < 1e-5) {
    lineY = (a.y + c.y) / 2;
  } else {
    lineY = a.y + ((p.x - a.x) * (c.y - a.y)) / dx;
  }
  return (p.y - lineY) / len;
}

/** Deviation of point p from line a->c (perpendicular distance / |ac|), unsigned. */
export function lineDeviation(a: Pt, c: Pt, p: Pt): number {
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const len = Math.hypot(acx, acy) || 1e-6;
  const cross = (p.x - a.x) * acy - (p.y - a.y) * acx;
  return Math.abs(cross) / (len * len);
}

/** Tilt of the torso from vertical, 0 = upright standing, 90 = horizontal. */
export function torsoTilt(shoulder: Pt, hip: Pt): number {
  const dx = shoulder.x - hip.x;
  const dy = shoulder.y - hip.y;
  const len = Math.hypot(dx, dy) || 1e-6;
  // up vector in image coords is (0,-1)
  const cos = Math.min(1, Math.max(-1, -dy / len));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function midpoint(a: Pt, b: Pt): Pt {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

export function visible(p: Pt | undefined, min = 0.45): p is Pt {
  return !!p && (p.visibility ?? 0) >= min;
}

/** Exponential moving average. */
export function ema(prev: number, next: number, alpha = 0.5): number {
  return prev + alpha * (next - prev);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
