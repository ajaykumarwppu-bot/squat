import { Pt, angleDeg, sagDeviation, torsoTilt, midpoint, visible, ema, clamp } from "./geometry";

export type ExerciseId = "pushup" | "squat" | "plank";
export type Mode = "auto" | ExerciseId;
export type Posture = ExerciseId | "idle";

export interface FormIssue {
  id: string;
  msg: string;
  severity: "warn" | "bad";
}

export interface FormEvent {
  id: number;
  clock: string;
  msg: string;
  tone: "good" | "warn" | "bad" | "info";
}

export interface EngineSnapshot {
  clock: string;
  tracking: boolean;
  mode: Mode;
  detected: Posture;
  confidence: number;
  active: Posture;
  reps: Record<ExerciseId, number>;
  phase: string;
  phaseProgress: number; // 0..1 within current range of motion
  angles: {
    knee: number | null;
    elbow: number | null;
    hipLine: number | null;
    tilt: number | null;
    hipDev: number | null;
    neck: number | null;
  };
  plank: { total: number; current: number; best: number; inPlank: boolean };
  formScore: number;
  issues: FormIssue[];
  cadence: number;
  lastRep: { n: number; quality: string; good: boolean } | null;
  events: FormEvent[];
  repFlash: number; // increments on every counted rep → triggers pop animation
}

const L = {
  shoulder: 11, rShoulder: 12,
  elbow: 13, rElbow: 14,
  wrist: 15, rWrist: 16,
  hip: 23, rHip: 24,
  knee: 25, rKnee: 26,
  ankle: 27, rAnkle: 28,
  ear: 7, rEar: 8,
};

const SQUAT_DOWN = 100; // knee angle below this = "in the hole"
const SQUAT_UP = 158;   // knee angle above this = standing
const PUSH_DOWN = 88;   // elbow angle below this = bottom of push-up
const PUSH_UP = 160;    // elbow angle above this = lockout

interface SideJoints {
  shoulder: Pt; elbow: Pt; wrist: Pt; hip: Pt; knee: Pt; ankle: Pt;
}

function bestSide(lm: Pt[], left: number, right: number): Pt {
  const a = lm[left];
  const b = lm[right];
  return (a.visibility ?? 0) >= (b.visibility ?? 0) ? a : b;
}

function jointsFrom(lm: Pt[]): SideJoints | null {
  const shoulder = bestSide(lm, L.shoulder, L.rShoulder);
  const elbow = bestSide(lm, L.elbow, L.rElbow);
  const wrist = bestSide(lm, L.wrist, L.rWrist);
  const hip = bestSide(lm, L.hip, L.rHip);
  const knee = bestSide(lm, L.knee, L.rKnee);
  const ankle = bestSide(lm, L.ankle, L.rAnkle);
  if (![shoulder, elbow, wrist, hip, knee, ankle].every((p) => visible(p, 0.4))) return null;
  return { shoulder, elbow, wrist, hip, knee, ankle };
}

interface RepCounter {
  state: "up" | "down";
  count: number;
  minAngle: number;
  lastRepAt: number;
}

export class ExerciseEngine {
  mode: Mode = "auto";
  private reps: Record<ExerciseId, number> = { pushup: 0, squat: 0, plank: 0 };
  private counters: Record<"pushup" | "squat", RepCounter> = {
    pushup: { state: "up", count: 0, minAngle: 180, lastRepAt: 0 },
    squat: { state: "up", count: 0, minAngle: 180, lastRepAt: 0 },
  };

  private votes: Posture[] = [];
  private detected: Posture = "idle";
  private confidence = 0;
  private active: Posture = "idle";
  private lastSwitchAt = 0;

  // smoothed metrics
  private sKnee = 178; private sElbow = 178; private sHipLine = 180;
  private sTilt = 0; private sHipDev = 0; private sNeck = 180;

  private plankTotal = 0; private plankCurrent = 0; private plankBest = 0;
  private inPlank = false; private plankBrokenAt = -10;

  private repTimes: number[] = [];
  private events: FormEvent[] = [];
  private eventSeq = 0;
  private lastEventAt: Record<string, number> = {};
  private issues: FormIssue[] = [];
  private issueFirstSeen: Record<string, number> = {};
  private lastRep: EngineSnapshot["lastRep"] = null;
  private repFlash = 0;

  private startAt = 0;
  private lastT = 0;
  tracking = false;
  private lostFrames = 0;

  constructor() {
    this.startAt = performance.now();
  }

  setMode(mode: Mode) {
    this.mode = mode;
    if (mode !== "auto") {
      this.active = mode;
      this.pushEvent(`MODE LOCKED → ${label(mode).toUpperCase()}`, "info");
    } else {
      this.active = "idle";
      this.pushEvent("AUTO RECOGNITION ENGAGED", "info");
    }
  }

  announce(msg: string, tone: FormEvent["tone"] = "info") {
    this.pushEvent(msg, tone, 1500);
  }

  resetCounts() {
    this.reps = { pushup: 0, squat: 0, plank: 0 };
    this.counters.pushup.count = 0;
    this.counters.squat.count = 0;
    this.plankTotal = 0; this.plankCurrent = 0; this.plankBest = 0;
    this.repTimes = [];
    this.lastRep = null;
    this.pushEvent("SESSION COUNTERS ZEROED", "info");
  }

  sessionSeconds(): number {
    return (performance.now() - this.startAt) / 1000;
  }

  totalVolume(): number {
    return this.reps.pushup + this.reps.squat + Math.round(this.plankTotal);
  }

  repsSnapshot(): Record<ExerciseId, number> {
    return { ...this.reps };
  }

  plankSnapshot(): { total: number; best: number } {
    return { total: this.plankTotal, best: this.plankBest };
  }

  private clock(): string {
    const s = Math.floor(this.sessionSeconds());
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  private pushEvent(msg: string, tone: FormEvent["tone"], throttleMs = 0) {
    const now = performance.now();
    const key = msg;
    if (throttleMs > 0 && now - (this.lastEventAt[key] ?? -1e9) < throttleMs) return;
    this.lastEventAt[key] = now;
    this.events = [{ id: ++this.eventSeq, clock: this.clock(), msg, tone }, ...this.events].slice(0, 40);
  }

  /** Main per-frame update. Returns a fresh snapshot. */
  update(lm: Pt[] | null, t: number): EngineSnapshot {
    const dt = this.lastT ? clamp((t - this.lastT) / 1000, 0, 0.1) : 0.016;
    this.lastT = t;

    const j = lm ? jointsFrom(lm) : null;

    if (!j) {
      this.lostFrames++;
      if (this.lostFrames === 20) this.pushEvent("TRACKING LOST — STEP INTO FRAME", "warn", 4000);
      if (this.lostFrames > 12) {
        this.tracking = false;
        this.inPlank = false;
      }
      return this.snapshot();
    }

    if (!this.tracking && this.lostFrames > 0) {
      if (this.lostFrames > 12) this.pushEvent("TRACKING RE-ACQUIRED", "good", 2000);
    }
    this.lostFrames = 0;
    this.tracking = true;

    // ---- raw metrics ----
    const knee = angleDeg(j.hip, j.knee, j.ankle);
    const elbow = angleDeg(j.shoulder, j.elbow, j.wrist);
    const hipLine = angleDeg(j.shoulder, j.hip, j.ankle);
    const tilt = torsoTilt(j.shoulder, j.hip);
    const hipDev = sagDeviation(j.shoulder, j.ankle, j.hip);
    const shoulderMid = j.shoulder;
    const ear = bestSide(lm!, L.ear, L.rEar);
    const neck = visible(ear, 0.4) ? angleDeg(j.hip, shoulderMid, ear) : 180;

    const a = 0.55;
    this.sKnee = ema(this.sKnee, knee, a);
    this.sElbow = ema(this.sElbow, elbow, a);
    this.sHipLine = ema(this.sHipLine, hipLine, a);
    this.sTilt = ema(this.sTilt, tilt, a);
    this.sHipDev = ema(this.sHipDev, hipDev, 0.4);
    this.sNeck = ema(this.sNeck, neck, a);

    // ---- posture classification vote ----
    this.classify(j);

    // ---- resolve active exercise ----
    if (this.mode !== "auto") {
      this.active = this.mode;
    } else if (
      this.detected !== "idle" &&
      this.detected !== this.active &&
      this.confidence >= 0.6 &&
      t - this.lastSwitchAt > 2200
    ) {
      if (this.active !== "idle") {
        this.pushEvent(`SWITCH → ${label(this.detected).toUpperCase()} DETECTED`, "info");
      }
      this.active = this.detected;
      this.lastSwitchAt = t;
      // reset phase state machines on switch
      this.counters.squat.state = this.sKnee < SQUAT_DOWN ? "down" : "up";
      this.counters.pushup.state = this.sElbow < PUSH_DOWN ? "down" : "up";
    } else if (this.active === "idle" && this.detected === "idle") {
      this.active = "idle";
    }

    // ---- per-exercise logic ----
    this.issues = [];
    if (this.active === "squat") this.runSquat(t);
    else if (this.active === "pushup") this.runPushup(t);
    else if (this.active === "plank") this.runPlank(dt, t);
    else this.inPlank = false;

    // ---- form issues → throttled spoken-style events ----
    for (const issue of this.issues) {
      const delay = issue.severity === "bad" ? 3200 : 4500;
      this.pushEvent(issue.msg, issue.severity === "bad" ? "bad" : "warn", delay);
    }

    return this.snapshot();
  }

  private classify(j: SideJoints) {
    let vote: Posture = "idle";
    const forearmFlat = Math.abs(j.elbow.y - j.wrist.y) < 0.085;

    if (this.sTilt > 55) {
      if (this.sElbow > 135) vote = "pushup";
      else if (this.sElbow >= 55) vote = forearmFlat ? "plank" : "pushup";
      else vote = "plank";
    } else if (this.sKnee < 148 || j.hip.y > j.knee.y - 0.04) {
      vote = "squat";
    }

    this.votes = [vote, ...this.votes].slice(0, 26);
    const tally: Record<string, number> = {};
    for (const v of this.votes) tally[v] = (tally[v] ?? 0) + 1;
    let top: Posture = "idle"; let n = 0;
    for (const k of Object.keys(tally) as Posture[]) {
      if (tally[k] > n) { n = tally[k]; top = k; }
    }
    this.detected = top;
    this.confidence = n / this.votes.length;
  }

  private addIssue(id: string, msg: string, severity: FormIssue["severity"]) {
    this.issues.push({ id, msg, severity });
  }

  // ---------------- SQUAT ----------------
  private runSquat(t: number) {
    const c = this.counters.squat;
    const ang = this.sKnee;

    if (c.state === "up" && ang < SQUAT_DOWN) {
      c.state = "down";
      c.minAngle = ang;
    } else if (c.state === "down") {
      c.minAngle = Math.min(c.minAngle, ang);
      if (ang > SQUAT_UP && t - c.lastRepAt > 500) {
        c.state = "up";
        c.count++;
        c.lastRepAt = t;
        this.reps.squat++;
        this.repTimes.push(t);
        this.repFlash++;
        const depth = c.minAngle;
        const quality = depth <= 82 ? "DEEP REP — EXCELLENT" : depth <= 102 ? "PARALLEL — SOLID REP" : "PARTIAL REP — SINK LOWER";
        this.lastRep = { n: this.reps.squat, quality, good: depth <= 102 };
        this.pushEvent(`SQUAT REP ${this.reps.squat} · ${quality}`, depth <= 102 ? "good" : "warn");
        c.minAngle = 180;
      }
    }

    // live form cues
    if (c.state === "down" && this.sTilt > 52) {
      this.addIssue("squat-lean", "CHEST UP — TOO MUCH FORWARD LEAN", "warn");
    }
    if (ang < 120 && this.sHipDev > 0.22) {
      this.addIssue("squat-butt", "HIPS TUCKING — KEEP WEIGHT MID-FOOT", "warn");
    }
    if (this.sHipLine < 148 && c.state === "down") {
      this.addIssue("squat-round", "DON'T ROUND THE LOWER BACK", "bad");
    }
  }

  // ---------------- PUSH-UP ----------------
  private runPushup(t: number) {
    const c = this.counters.pushup;
    const ang = this.sElbow;

    if (c.state === "up" && ang < PUSH_DOWN) {
      c.state = "down";
      c.minAngle = ang;
    } else if (c.state === "down") {
      c.minAngle = Math.min(c.minAngle, ang);
      if (ang > PUSH_UP && t - c.lastRepAt > 500) {
        c.state = "up";
        c.count++;
        c.lastRepAt = t;
        this.reps.pushup++;
        this.repTimes.push(t);
        this.repFlash++;
        const depth = c.minAngle;
        const quality = depth <= 72 ? "FULL ROM — CHEST TO FLOOR" : depth <= 92 ? "GOOD DEPTH REP" : "SHORT REP — GO DEEPER";
        this.lastRep = { n: this.reps.pushup, quality, good: depth <= 92 };
        this.pushEvent(`PUSH-UP REP ${this.reps.pushup} · ${quality}`, depth <= 92 ? "good" : "warn");
        c.minAngle = 180;
      }
    }

    // body line
    if (this.sHipDev > 0.14) this.addIssue("push-sag", "HIPS SAGGING — BRACE YOUR CORE", "bad");
    else if (this.sHipDev < -0.14) this.addIssue("push-pike", "HIPS PIKED — ONE STRAIGHT LINE", "warn");
    if (c.state === "up" && ang < 165 && ang > 120) {
      this.addIssue("push-lock", "LOCK OUT AT THE TOP", "warn");
    }
  }

  // ---------------- PLANK ----------------
  private runPlank(dt: number, t: number) {
    const poseOk = this.sElbow >= 45 && this.sElbow <= 125 && this.sTilt > 50;
    const lineOk = Math.abs(this.sHipDev) < 0.3;
    const now = this.inPlank;
    this.inPlank = poseOk && lineOk;

    if (this.inPlank) {
      this.plankCurrent += dt;
      this.plankTotal += dt;
      if (this.plankCurrent > this.plankBest) this.plankBest = this.plankCurrent;
      if (!now && this.plankCurrent > 0.4) this.pushEvent("PLANK HOLD STARTED", "info", 3000);
      const milestones = [15, 30, 45, 60, 90, 120, 180, 240, 300];
      for (const m of milestones) {
        if (this.plankCurrent >= m && this.plankCurrent - dt < m) {
          this.pushEvent(`PLANK ${m}s — KEEP BREATHING`, "good");
        }
      }
    } else {
      if (now && this.plankCurrent > 3) {
        this.pushEvent(`HOLD BROKEN AT ${Math.floor(this.plankCurrent)}s`, "warn", 2000);
        this.plankBrokenAt = t;
      }
      this.plankCurrent = 0;
    }

    // form cues
    if (poseOk || this.sTilt > 50) {
      if (this.sHipDev > 0.12) this.addIssue("plank-sag", "HIPS SAGGING — SQUEEZE GLUTES, LIFT HIPS", "bad");
      else if (this.sHipDev < -0.12) this.addIssue("plank-pike", "HIPS TOO HIGH — LOWER TO A STRAIGHT LINE", "warn");
      if (this.sNeck < 148) this.addIssue("plank-neck", "NECK DROPPING — GAZE AT THE FLOOR", "warn");
      if (this.sElbow > 108) this.addIssue("plank-elbow", "ELBOWS UNDER SHOULDERS, 90°", "warn");
    }
  }

  private cadence(): number {
    const now = performance.now();
    const recent = this.repTimes.filter((t) => now - t < 30000);
    this.repTimes = recent;
    if (recent.length < 2) return 0;
    const span = (recent[recent.length - 1] - recent[0]) / 1000;
    if (span < 3) return 0;
    return Math.round(((recent.length - 1) / span) * 60);
  }

  private formScore(): number {
    if (!this.tracking || this.active === "idle") return 100;
    let score = 100;
    for (const i of this.issues) score -= i.severity === "bad" ? 22 : 12;
    if (this.active === "plank" && !this.inPlank) score -= 30;
    return clamp(Math.round(score), 0, 100);
  }

  private phaseInfo(): { phase: string; progress: number } {
    if (this.active === "squat") {
      const c = this.counters.squat;
      const p = clamp((SQUAT_UP - this.sKnee) / (SQUAT_UP - 70), 0, 1);
      return { phase: c.state === "down" ? "IN THE HOLE" : this.sKnee < 150 ? "DESCENT" : "STANDING", progress: p };
    }
    if (this.active === "pushup") {
      const c = this.counters.pushup;
      const p = clamp((PUSH_UP - this.sElbow) / (PUSH_UP - 55), 0, 1);
      return { phase: c.state === "down" ? "BOTTOM" : this.sElbow < 150 ? "DESCENT" : "LOCKOUT", progress: p };
    }
    if (this.active === "plank") {
      return { phase: this.inPlank ? "HOLDING" : "GET INTO PLANK", progress: clamp(this.plankCurrent / 60, 0, 1) };
    }
    return { phase: this.tracking ? "READY" : "NO SIGNAL", progress: 0 };
  }

  private snapshot(): EngineSnapshot {
    const { phase, progress } = this.phaseInfo();
    return {
      clock: this.clock(),
      tracking: this.tracking,
      mode: this.mode,
      detected: this.detected,
      confidence: this.confidence,
      active: this.active,
      reps: { ...this.reps },
      phase,
      phaseProgress: progress,
      angles: {
        knee: this.tracking ? Math.round(this.sKnee) : null,
        elbow: this.tracking ? Math.round(this.sElbow) : null,
        hipLine: this.tracking ? Math.round(this.sHipLine) : null,
        tilt: this.tracking ? Math.round(this.sTilt) : null,
        hipDev: this.tracking ? +this.sHipDev.toFixed(2) : null,
        neck: this.tracking ? Math.round(this.sNeck) : null,
      },
      plank: {
        total: this.plankTotal,
        current: this.plankCurrent,
        best: this.plankBest,
        inPlank: this.inPlank,
      },
      formScore: this.formScore(),
      issues: [...this.issues],
      cadence: this.cadence(),
      lastRep: this.lastRep,
      events: this.events,
      repFlash: this.repFlash,
    };
  }
}

export function label(p: Posture | Mode): string {
  switch (p) {
    case "pushup": return "Push-Up";
    case "squat": return "Squat";
    case "plank": return "Plank";
    case "idle": return "Idle";
    case "auto": return "Auto";
  }
}

export const EXERCISES: ExerciseId[] = ["pushup", "squat", "plank"];
