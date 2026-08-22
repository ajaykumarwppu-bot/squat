import React from "react";
import { EngineSnapshot, Mode, ExerciseId, label } from "../lib/engine";
import { formatClock } from "../lib/geometry";
import { Lifetime } from "../hooks/usePoseTracker";
import {
  AutoIcon, PushupIcon, SquatIcon, PlankIcon, TargetIcon,
  AngleIcon, ResetIcon, FlameIcon, BoltIcon, CheckIcon, AlertIcon, PulseIcon,
} from "./icons";

interface Props {
  snap: EngineSnapshot | null;
  mode: Mode;
  onMode: (m: Mode) => void;
  onReset: () => void;
  lifetime: Lifetime;
  target: number;
  onTarget: (n: number) => void;
  onAnnounce: (msg: string, tone?: "good" | "warn" | "bad" | "info") => void;
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-panel panel-cut">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h3 className="font-display text-[11px] font-bold tracking-[0.24em] text-mist">{title}</h3>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function AngleBar({ name, value, markers, goodZone }: {
  name: string;
  value: number | null;
  markers: { at: number; color: string }[];
  goodZone: [number, number];
}) {
  const v = value ?? 0;
  const inGood = value !== null && v >= goodZone[0] && v <= goodZone[1];
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[11px]">
        <span className="tracking-[0.2em] text-fog">{name}</span>
        <span className={`text-sm font-bold ${value === null ? "text-fog" : inGood ? "text-volt" : "text-bone"}`}>
          {value === null ? "——" : `${value}°`}
        </span>
      </div>
      <div className="relative mt-1.5 h-2.5 w-full bg-pit border border-line">
        <div className="absolute inset-y-0 bg-volt/12"
          style={{ left: `${(goodZone[0] / 180) * 100}%`, width: `${((goodZone[1] - goodZone[0]) / 180) * 100}%` }} />
        <div className={`absolute inset-y-0 left-0 transition-all duration-150 ${value === null ? "bg-line2" : inGood ? "bg-volt" : "bg-icecyan"}`}
          style={{ width: `${(v / 180) * 100}%` }} />
        {markers.map((m, i) => (
          <span key={i} className="absolute inset-y-[-3px] w-[2px]" style={{ left: `${(m.at / 180) * 100}%`, background: m.color }} />
        ))}
      </div>
    </div>
  );
}

function DevMeter({ dev }: { dev: number | null }) {
  const d = dev ?? 0;
  const pos = 50 + Math.max(-1, Math.min(1, d / 0.3)) * 50;
  const ok = dev !== null && Math.abs(d) < 0.12;
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[11px]">
        <span className="tracking-[0.2em] text-fog">HIP DEVIATION</span>
        <span className={`text-sm font-bold ${dev === null ? "text-fog" : ok ? "text-volt" : "text-coral"}`}>
          {dev === null ? "——" : `${d > 0 ? "+" : ""}${d.toFixed(2)}`}
        </span>
      </div>
      <div className="relative mt-1.5 h-2.5 w-full bg-pit border border-line">
        <div className="absolute inset-y-0 left-[30%] w-[40%] bg-volt/12" />
        <span className="absolute inset-y-[-3px] left-1/2 w-[2px] bg-line2" />
        <span className={`absolute top-1/2 h-4 w-[3px] -translate-y-1/2 transition-all duration-150 ${dev === null ? "bg-line2" : ok ? "bg-volt" : "bg-coral"}`}
          style={{ left: `calc(${pos}% - 1px)` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] tracking-[0.18em] text-fog">
        <span>◂ PIKE</span><span>STRAIGHT</span><span>SAG ▸</span>
      </div>
    </div>
  );
}

const TONE_DOT: Record<string, string> = {
  good: "bg-volt",
  warn: "bg-ambery",
  bad: "bg-coral",
  info: "bg-icecyan",
};
const TONE_TXT: Record<string, string> = {
  good: "text-volt",
  warn: "text-ambery",
  bad: "text-coral",
  info: "text-mist",
};

export default function Deck({ snap, mode, onMode, onReset, lifetime, target, onTarget, onAnnounce }: Props) {
  const reps = snap?.reps ?? { pushup: 0, squat: 0, plank: 0 };
  const activeCount = snap && snap.active !== "idle" && snap.active !== "plank" ? reps[snap.active] : 0;
  const targetHit = activeCount >= target && target > 0;

  const kcal = Math.round(reps.pushup * 0.6 + reps.squat * 0.8 + (snap?.plank.total ?? 0) * 0.09);

  const modes: { id: Mode; icon: React.ReactNode; count?: number; hint: string }[] = [
    { id: "auto", icon: <AutoIcon size={19} />, hint: "classify from movement" },
    { id: "pushup", icon: <PushupIcon size={19} />, count: reps.pushup, hint: "elbow angle ROM" },
    { id: "squat", icon: <SquatIcon size={19} />, count: reps.squat, hint: "knee angle ROM" },
    { id: "plank", icon: <PlankIcon size={19} />, hint: "hold + line check" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* MODE SELECTOR */}
      <Section
        title="EXERCISE MODE"
        right={<span className="font-mono text-[10px] tracking-[0.18em] text-fog">{mode === "auto" ? "AI CLASSIFYING" : "MANUAL LOCK"}</span>}
      >
        <div className="grid grid-cols-2 gap-2">
          {modes.map((m) => {
            const on = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onMode(m.id)}
                className={`group relative border px-3 py-2.5 text-left transition-all duration-150 ${
                  on
                    ? "border-volt/70 bg-panel2 text-bone"
                    : "border-line bg-pit text-mist hover:border-line2 hover:bg-panel2"
                }`}
              >
                {on && <span className="absolute left-0 top-0 h-full w-[3px] bg-volt" />}
                <span className={`block ${on ? "text-volt" : "text-fog group-hover:text-mist"}`}>{m.icon}</span>
                <span className="mt-1.5 block font-display text-[11px] font-bold tracking-[0.14em]">
                  {label(m.id).toUpperCase()}
                  {m.count !== undefined && <span className={`ml-2 font-mono ${on ? "text-volt" : "text-fog"}`}>{m.count}</span>}
                </span>
                <span className="mt-0.5 block font-mono text-[9px] tracking-[0.1em] text-fog">{m.hint}</span>
              </button>
            );
          })}
        </div>

        {/* target */}
        <div className="mt-3 flex items-center justify-between border border-line bg-pit px-3 py-2">
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-fog">
            <TargetIcon size={15} className="text-icecyan" /> TARGET REPS
          </span>
          <span className="flex items-center gap-2">
            <button onClick={() => onTarget(Math.max(0, target - 5))}
              className="h-6 w-6 border border-line bg-panel2 font-mono text-sm text-mist hover:border-line2 hover:text-bone">−</button>
            <span className="w-8 text-center font-mono text-sm font-bold text-bone">{target}</span>
            <button onClick={() => onTarget(Math.min(200, target + 5))}
              className="h-6 w-6 border border-line bg-panel2 font-mono text-sm text-mist hover:border-line2 hover:text-bone">+</button>
          </span>
        </div>
        {targetHit && (
          <div className="mt-2 flex items-center gap-2 border border-volt/60 bg-volt/10 px-3 py-1.5 animate-feedin">
            <CheckIcon size={14} className="text-volt" />
            <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-volt">
              TARGET HIT — {target} REPS BANKED
            </span>
            <button
              className="ml-auto font-mono text-[10px] tracking-[0.14em] text-fog underline decoration-line2 underline-offset-4 hover:text-bone"
              onClick={() => { onTarget(target + 10); onAnnounce(`TARGET RAISED → ${target + 10} REPS`, "info"); }}
            >
              RAISE +10
            </button>
          </div>
        )}
      </Section>

      {/* TELEMETRY */}
      <Section title="JOINT TELEMETRY" right={<AngleIcon size={15} className="text-fog" />}>
        <div className="flex flex-col gap-4">
          <AngleBar name="KNEE · L/R BEST" value={snap?.angles.knee ?? null}
            goodZone={[60, 100]}
            markers={[{ at: 100, color: "#ffb454" }, { at: 158, color: "#5fe0f7" }]} />
          <AngleBar name="ELBOW · L/R BEST" value={snap?.angles.elbow ?? null}
            goodZone={[55, 88]}
            markers={[{ at: 88, color: "#ffb454" }, { at: 160, color: "#5fe0f7" }]} />
          <DevMeter dev={snap?.angles.hipDev ?? null} />
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="border border-line bg-pit px-2.5 py-1.5">
              <span className="block text-[9px] tracking-[0.2em] text-fog">TRUNK LINE</span>
              <span className="text-bone">{snap?.angles.hipLine ?? "——"}°</span>
            </div>
            <div className="border border-line bg-pit px-2.5 py-1.5">
              <span className="block text-[9px] tracking-[0.2em] text-fog">TORSO TILT</span>
              <span className="text-bone">{snap?.angles.tilt ?? "——"}°</span>
            </div>
          </div>
        </div>
      </Section>

      {/* FORM FEED */}
      <Section
        title="FORM FEED"
        right={
          snap && snap.issues.length > 0 ? (
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-coral">
              <AlertIcon size={12} /> {snap.issues.length} CUE{snap.issues.length > 1 ? "S" : ""}
            </span>
          ) : (
            <span className="font-mono text-[10px] tracking-[0.14em] text-volt">CLEAN</span>
          )
        }
      >
        <div className="max-h-44 overflow-y-auto pr-1">
          {!snap || snap.events.length === 0 ? (
            <p className="font-mono text-[11px] leading-5 text-fog">
              No cues yet. Start moving — every rep and form break lands here with a timestamp.
            </p>
          ) : (
            <ul className="flex flex-col">
              {snap.events.map((e) => (
                <li key={e.id} className="animate-feedin flex items-start gap-2.5 border-b border-line/60 py-1.5 last:border-0">
                  <span className="mt-1 font-mono text-[9px] text-fog">{e.clock}</span>
                  <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 ${TONE_DOT[e.tone]}`} />
                  <span className={`font-mono text-[11px] leading-4 tracking-wide ${TONE_TXT[e.tone]}`}>{e.msg}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {/* SESSION */}
      <Section title="SESSION LEDGER" right={<button onClick={onReset}
        className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-fog hover:text-coral">
        <ResetIcon size={13} /> ZERO
      </button>}>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { k: "PUSH-UP", v: String(reps.pushup), c: "text-bone" },
            { k: "SQUAT", v: String(reps.squat), c: "text-bone" },
            { k: "PLANK", v: formatClock(snap?.plank.total ?? 0), c: "text-bone" },
          ].map((s) => (
            <div key={s.k} className="border border-line bg-pit py-2.5">
              <div className={`font-display text-xl font-bold ${s.c}`}>{s.v}</div>
              <div className="mt-0.5 font-mono text-[9px] tracking-[0.22em] text-fog">{s.k}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-mist">
          <span className="flex items-center gap-1.5"><FlameIcon size={14} className="text-ambery" /> ≈ {kcal} KCAL EST</span>
          <span className="flex items-center gap-1.5"><BoltIcon size={14} className="text-volt" /> {snap?.cadence ?? 0} /MIN</span>
          <span className="flex items-center gap-1.5"><PulseIcon size={14} className="text-icecyan" /> BEST {formatClock(snap?.plank.best ?? 0)}</span>
        </div>
        <div className="mt-3 border-t border-line pt-2.5 font-mono text-[10px] tracking-[0.14em] text-fog">
          LIFETIME · {lifetime.pushup + lifetime.squat} REPS + {formatClock(lifetime.plankSeconds)} PLANK · {lifetime.sessions} SESSIONS
        </div>
      </Section>
    </div>
  );
}
