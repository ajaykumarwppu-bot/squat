import React, { useEffect, useRef, useState } from "react";
import { TrackerStatus } from "../hooks/usePoseTracker";
import { Mark, CameraIcon, StopIcon, PulseIcon, EyeIcon, AngleIcon, BoltIcon } from "./icons";

/* ---------------- HEADER ---------------- */

export function Header({ status, fps, clock, onStop }: {
  status: TrackerStatus; fps: number; clock: string; onStop: () => void;
}) {
  const pill =
    status === "live"
      ? { txt: "LIVE", cls: "border-volt/60 text-volt", dot: "bg-volt animate-blinker" }
      : status === "loading"
        ? { txt: "BOOTING", cls: "border-ambery/60 text-ambery", dot: "bg-ambery animate-blinker" }
        : status === "error"
          ? { txt: "FAULT", cls: "border-coral/60 text-coral", dot: "bg-coral" }
          : { txt: "STANDBY", cls: "border-line2 text-fog", dot: "bg-fog" };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-6">
        <a href="#" className="flex items-center gap-2.5">
          <Mark size={28} />
          <span className="font-display text-base font-black tracking-[0.14em] text-bone">
            KINETI<span className="text-volt">Q</span>
          </span>
          <span className="mt-0.5 hidden font-mono text-[9px] tracking-[0.28em] text-fog sm:block">
            REAL-TIME FORM LAB
          </span>
        </a>

        <div className="ml-auto flex items-center gap-2.5">
          <span className="hidden font-mono text-[10px] tracking-[0.2em] text-fog md:block">
            T+{clock}
          </span>
          <span className="hidden border border-line bg-panel px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-mist md:block">
            {status === "live" ? `${fps} FPS` : "— FPS"}
          </span>
          <span className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] font-bold tracking-[0.18em] ${pill.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} /> {pill.txt}
          </span>
          {status === "live" && (
            <button onClick={onStop}
              className="flex items-center gap-1.5 border border-coral/60 px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.18em] text-coral transition-colors hover:bg-coral hover:text-ink">
              <StopIcon size={13} /> DISARM
            </button>
          )}
          {(status === "boot" || status === "stopped" || status === "error") && (
            <span className="hidden items-center gap-1.5 border border-line px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-fog sm:flex">
              <CameraIcon size={13} /> SENSOR OFF
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

/* ---------------- CUE TICKER ---------------- */

const CUES = [
  "SQUAT — BREAK PARALLEL, KNEES TRACK OVER TOES",
  "PUSH-UP — ONE STRAIGHT LINE, HEAD TO NEUTRAL",
  "PLANK — SQUEEZE GLUTES, RIBS STACKED OVER PELVIS",
  "TEMPO BEATS MOMENTUM — 2s DOWN, 1s UP",
  "ELBOWS 45° — SAVE YOUR SHOULDERS",
  "PLANK — GAZE AT THE FLOOR, NECK LONG",
  "BRACE LIKE SOMEONE'S ABOUT TO PUNCH YOU",
  "DEPTH IS NON-NEGOTIABLE — COUNT FULL REPS ONLY",
];

export function Ticker() {
  const row = [...CUES, ...CUES];
  return (
    <div className="overflow-hidden border-y border-line bg-pit py-2.5">
      <div className="animate-ticker flex w-max items-center gap-8">
        {row.map((c, i) => (
          <span key={i} aria-hidden={i >= CUES.length}
            className="flex items-center gap-8 whitespace-nowrap font-mono text-[10px] tracking-[0.24em] text-fog">
            {c} <span className={i % 2 ? "text-icecyan" : "text-volt"}>▲</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- SCROLL REVEAL ---------------- */

export function Reveal({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); obs.disconnect(); } },
      { threshold: 0.18 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`${className} transition-all duration-700 ease-out ${seen ? "translate-y-0 opacity-100" : "translate-y-7 opacity-0"}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ---------------- SIGNAL CHAIN ---------------- */

const STAGES = [
  {
    n: "01", icon: <CameraIcon size={22} />, accent: "text-icecyan", bar: "bg-icecyan",
    t: "CAPTURE",
    d: "Your webcam streams a mirrored 720p feed straight into the browser tab. Frames never touch a server — the entire pipeline lives on your device.",
    spec: "getUserMedia · 30–60 fps",
  },
  {
    n: "02", icon: <EyeIcon size={22} />, accent: "text-volt", bar: "bg-volt",
    t: "LANDMARKS",
    d: "A MediaPipe pose landmarker regresses 33 anatomical keypoints per frame — shoulders, elbows, wrists, hips, knees, ankles — each with a visibility score.",
    spec: "33 keypoints · WASM + GPU",
  },
  {
    n: "03", icon: <AngleIcon size={22} />, accent: "text-ambery", bar: "bg-ambery",
    t: "GEOMETRY",
    d: "Joint angles, torso tilt and signed hip deviation are computed from the skeleton and smoothed with exponential filters to kill jitter without adding lag.",
    spec: "EMA α=0.55 · hip-line projection",
  },
  {
    n: "04", icon: <BoltIcon size={22} />, accent: "text-coral", bar: "bg-coral",
    t: "VERDICT",
    d: "Hysteresis state machines turn angle streams into reps, phases and form cues: below 100° is a squat, below 88° is a push-up, ±0.12 hip deviation breaks a plank.",
    spec: "rep FSM · posture voting",
  },
];

export function SignalChain() {
  return (
    <section id="chain" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Reveal>
            <div className="font-mono text-[11px] tracking-[0.3em] text-icecyan">INSIDE THE LOOP</div>
            <h2 className="mt-4 font-display font-black leading-[1.02] text-bone"
              style={{ fontSize: "clamp(30px, 3.6vw, 52px)" }}>
              PIXELS IN.<br />
              <span className="text-outline">VERDICTS</span> OUT<span className="text-volt">.</span>
            </h2>
            <p className="mt-5 max-w-md text-[14px] leading-6 text-mist">
              Every frame runs the full chain in under ~20 ms. The stick figure you see is the
              actual landmark graph the counter is reading — what it draws, it measures.
            </p>
            <div className="mt-6 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-fog">
              <PulseIcon size={15} className="text-volt" /> LOOP BUDGET ≈ 16 MS / FRAME
            </div>
          </Reveal>
        </div>

        <div className="flex flex-col">
          {STAGES.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <div className="group relative grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 border border-line bg-panel px-5 py-5 transition-all duration-200 hover:border-line2 hover:bg-panel2 sm:grid-cols-[84px_auto_1fr]">
                <span className={`absolute left-0 top-0 h-full w-[3px] ${s.bar} opacity-70 transition-opacity group-hover:opacity-100`} />
                <span className="text-outline font-display text-4xl font-black leading-none transition-colors group-hover:text-bone sm:text-5xl"
                  style={{ WebkitTextStroke: "1.5px rgba(233,239,234,0.3)" }}>
                  {s.n}
                </span>
                <span className={`hidden sm:block ${s.accent}`}>{s.icon}</span>
                <span>
                  <span className={`font-display text-sm font-bold tracking-[0.22em] ${s.accent}`}>{s.t}</span>
                  <span className="mt-1.5 block text-[13px] leading-6 text-mist">{s.d}</span>
                  <span className="mt-2 inline-block border border-line bg-pit px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-fog">
                    {s.spec}
                  </span>
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- FOOTER ---------------- */

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-5 sm:px-6">
        <span className="flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.2em] text-mist">
          <Mark size={18} /> KINETIQ
        </span>
        <span className="font-mono text-[9px] tracking-[0.2em] text-fog">
          POSE BY MEDIAPIPE TASKS · ALL INFERENCE ON-DEVICE
        </span>
        <span className="ml-auto font-mono text-[9px] tracking-[0.2em] text-fog">
          FORM CUES ARE GUIDANCE — TRAIN WITHIN YOUR LIMITS
        </span>
      </div>
    </footer>
  );
}
