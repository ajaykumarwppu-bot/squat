import React from "react";
import { TrackerStatus, Lifetime } from "../hooks/usePoseTracker";
import { formatClock } from "../lib/geometry";
import { CameraIcon, BoltIcon, EyeIcon, AlertIcon, CheckIcon, PulseIcon } from "./icons";

interface Props {
  status: TrackerStatus;
  error: string | null;
  onStart: () => void;
  lifetime: Lifetime;
}

function Joint({ cx, cy, delay }: { cx: number; cy: number; delay: string }) {
  return (
    <circle cx={cx} cy={cy} r="5" fill="#0b0e11" stroke="#c6f235" strokeWidth="2.5"
      className="animate-jointpulse" style={{ animationDelay: delay }} />
  );
}

function SkeletonRig() {
  return (
    <div className="relative border border-line bg-pit panel-cut noise">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="font-mono text-[10px] tracking-[0.24em] text-fog">REFERENCE RIG · SIDE VIEW</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-volt">
          <span className="h-1.5 w-1.5 rounded-full bg-volt animate-blinker" /> CALIBRATED
        </span>
      </div>
      <div className="relative p-4">
        <svg viewBox="0 0 340 300" className="w-full">
          {/* floor */}
          <line x1="24" y1="272" x2="316" y2="272" stroke="#313c48" strokeWidth="2" />
          {[40, 90, 140, 190, 240, 290].map((x) => (
            <line key={x} x1={x} y1="272" x2={x - 10} y2="284" stroke="#252e38" strokeWidth="1.5" />
          ))}
          {/* plumb line */}
          <line x1="150" y1="24" x2="150" y2="268" stroke="#313c48" strokeWidth="1" strokeDasharray="4 7" />
          {/* body: mid-squat figure */}
          <g stroke="#e9efea" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M150 62 L163 128" strokeDasharray="420" className="animate-dashdraw" />
            <path d="M156 84 L196 108 L216 96" strokeDasharray="420" className="animate-dashdraw" style={{ animationDelay: "0.4s" }} />
            <path d="M163 128 L216 168 L196 252" strokeDasharray="420" className="animate-dashdraw" style={{ animationDelay: "0.8s" }} />
            <path d="M196 252 L228 252" strokeDasharray="420" className="animate-dashdraw" style={{ animationDelay: "1s" }} />
          </g>
          <circle cx="146" cy="42" r="19" fill="none" stroke="#e9efea" strokeWidth="3.5" />
          {/* angle arc at knee */}
          <path d="M196 138 A30 30 0 0 0 186 162" fill="none" stroke="#c6f235" strokeWidth="2.5" />
          <text x="160" y="160" fill="#c6f235" fontFamily="JetBrains Mono, monospace" fontSize="12" fontWeight="700">104°</text>
          {/* hip dev guide */}
          <line x1="150" y1="62" x2="196" y2="252" stroke="#5fe0f7" strokeWidth="1.5" strokeDasharray="5 6" opacity="0.7" />
          <text x="205" y="120" fill="#5fe0f7" fontFamily="JetBrains Mono, monospace" fontSize="11">HIP Δ +0.02</text>
          <text x="30" y="110" fill="#7f8d9a" fontFamily="JetBrains Mono, monospace" fontSize="10" letterSpacing="2">TORSO 32°</text>
          <Joint cx={150} cy={62} delay="0s" />
          <Joint cx={163} cy={128} delay="0.5s" />
          <Joint cx={216} cy={168} delay="1s" />
          <Joint cx={196} cy={252} delay="1.5s" />
        </svg>
        <div className="animate-breathe pointer-events-none absolute -inset-6 -z-10"
          style={{ background: "radial-gradient(60% 55% at 55% 45%, rgba(198,242,53,0.10), transparent 70%)" }} />
      </div>
    </div>
  );
}

export default function StartGate({ status, error, onStart, lifetime }: Props) {
  const loading = status === "loading";
  const checks = [
    { icon: <CameraIcon size={16} />, txt: "CAMERA → 720P MIRROR FEED" },
    { icon: <EyeIcon size={16} />, txt: "33-POINT SKELETON @ ~60 FPS" },
    { icon: <BoltIcon size={16} />, txt: "ANGLES → REP STATE MACHINES" },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 items-start">
      {/* left: statement */}
      <div className="animate-riseup">
        <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.3em] text-icecyan">
          <PulseIcon size={16} />
          ON-DEVICE POSE ENGINE · NO UPLOADS
        </div>
        <h1 className="mt-5 font-display font-black leading-[0.98] text-bone"
          style={{ fontSize: "clamp(38px, 5.6vw, 74px)" }}>
          YOUR BODY<br />
          IS THE <span className="text-outline">SENSOR</span><span className="text-volt">.</span>
        </h1>
        <p className="mt-6 max-w-xl text-[15px] leading-7 text-mist">
          KINETIQ watches you train through the camera and draws a live stick-figure skeleton over
          your body. It reads <b className="text-bone">knee and elbow angles</b> to count push-ups and squats,
          classifies the movement on its own, and during planks it holds a stopwatch on your
          <b className="text-bone"> hip line</b> — calling out sag, pike and neck drop the second your form slips.
        </p>

        <ul className="mt-7 flex flex-col gap-2.5">
          {checks.map((c, i) => (
            <li key={c.txt} className="animate-riseup flex items-center gap-3 font-mono text-[11px] tracking-[0.18em] text-fog"
              style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
              <span className="flex h-7 w-7 items-center justify-center border border-line bg-panel text-volt">{c.icon}</span>
              {c.txt}
              <CheckIcon size={13} className="ml-auto text-volt/70" />
            </li>
          ))}
        </ul>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <button
            onClick={onStart}
            disabled={loading}
            className={`group relative border-2 px-8 py-4 font-display text-sm font-bold tracking-[0.22em] transition-all duration-150 ${
              loading
                ? "cursor-wait border-line2 text-fog"
                : "border-volt bg-volt text-ink hover:bg-transparent hover:text-volt active:scale-95"
            }`}
          >
            {loading ? "BOOTING ENGINE…" : status === "stopped" ? "RE-ARM CAMERA" : "START TRACKING"}
            {!loading && <span className="absolute -right-1.5 -top-1.5 h-3 w-3 border-r-2 border-t-2 border-coral" />}
          </button>
          <span className="font-mono text-[10px] leading-4 tracking-[0.14em] text-fog">
            FIRST BOOT DOWNLOADS THE<br />POSE MODEL (~5 MB) — THEN IT'S CACHED
          </span>
        </div>

        {error && (
          <div className="mt-6 flex max-w-xl items-start gap-3 border border-coral/60 bg-coral/10 px-4 py-3 animate-feedin">
            <AlertIcon size={18} className="mt-0.5 shrink-0 text-coral" />
            <p className="font-mono text-[11px] leading-5 tracking-wide text-coral">{error}</p>
          </div>
        )}

        {status === "stopped" && !error && (
          <div className="mt-6 max-w-xl border border-line bg-panel px-4 py-3 font-mono text-[11px] tracking-[0.14em] text-mist animate-feedin">
            SENSOR DISARMED — SESSION SAVED TO LEDGER · LIFETIME{" "}
            <b className="text-volt">{lifetime.pushup + lifetime.squat} REPS</b> +{" "}
            <b className="text-volt">{formatClock(lifetime.plankSeconds)}</b> PLANK
          </div>
        )}
      </div>

      {/* right: rig */}
      <div className="animate-riseup" style={{ animationDelay: "0.2s" }}>
        <SkeletonRig />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { k: "PUSH-UP", v: "ELBOW < 88°" },
            { k: "SQUAT", v: "KNEE < 100°" },
            { k: "PLANK", v: "HIP Δ ± 0.12" },
          ].map((r) => (
            <div key={r.k} className="border border-line bg-panel px-3 py-2.5 transition-colors hover:border-volt/50">
              <div className="font-display text-[10px] font-bold tracking-[0.18em] text-bone">{r.k}</div>
              <div className="mt-1 font-mono text-[10px] text-fog">{r.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
