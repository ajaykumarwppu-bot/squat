import React from "react";
import { EngineSnapshot, label } from "../lib/engine";
import { formatClock } from "../lib/geometry";
import { TrackerStatus } from "../hooks/usePoseTracker";
import { EyeIcon, AlertIcon, PulseIcon } from "./icons";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  snap: EngineSnapshot | null;
  status: TrackerStatus;
}

function Corner({ cls }: { cls: string }) {
  return (
    <div className={`absolute h-5 w-5 border-volt/70 pointer-events-none z-20 ${cls}`} />
  );
}

export default function Stage({ videoRef, canvasRef, snap, status }: Props) {
  const live = status === "live";
  const tracking = live && !!snap?.tracking;
  const active = snap?.active ?? "idle";
  const isPlank = active === "plank";
  const isCounting = active === "squat" || active === "pushup";

  const bigValue = !live
    ? "—"
    : isPlank
      ? formatClock(snap?.plank.current ?? 0)
      : isCounting
        ? String(snap?.reps[active] ?? 0)
        : "··";

  const score = snap?.formScore ?? 100;
  const lamp =
    !tracking
      ? { txt: "NO SIGNAL", cls: "text-fog border-line2", dot: "bg-fog" }
      : score >= 85
        ? { txt: "FORM LOCKED", cls: "text-volt border-volt/50", dot: "bg-volt" }
        : score >= 60
          ? { txt: "DRIFTING", cls: "text-ambery border-ambery/50", dot: "bg-ambery" }
          : { txt: "BREAKDOWN", cls: "text-coral border-coral/60", dot: "bg-coral animate-blinker" };

  return (
    <div className="relative noise">
      <div className="relative overflow-hidden border border-line bg-pit panel-cut">
        {/* corner brackets */}
        <Corner cls="top-2 left-2 border-t-2 border-l-2" />
        <Corner cls="top-2 right-2 border-t-2 border-r-2" />
        <Corner cls="bottom-2 left-2 border-b-2 border-l-2" />
        <Corner cls="bottom-2 right-2 border-b-2 border-r-2" />

        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 h-full w-full -scale-x-100 object-cover opacity-80 saturate-[0.85] contrast-105"
          />
          <canvas ref={canvasRef as React.RefObject<HTMLCanvasElement>} className="absolute inset-0 h-full w-full" />

          {/* atmosphere */}
          <div className="stage-vignette pointer-events-none absolute inset-0" />
          <div className="gridfield pointer-events-none absolute inset-0 opacity-60" />
          {live && (
            <div className="animate-scanline pointer-events-none absolute left-0 right-0 h-16 z-10"
              style={{ background: "linear-gradient(to bottom, transparent, rgba(198,242,53,0.06) 55%, rgba(198,242,53,0.14) 60%, transparent)" }}
            />
          )}

          {/* ============ HUD ============ */}
          {live && snap && (
            <>
              {/* top-left: active exercise + detection */}
              <div className="absolute left-5 top-4 z-20 flex items-center gap-3">
                <div className="border border-line2 bg-ink/80 px-3 py-2">
                  <div className="font-mono text-[10px] tracking-[0.22em] text-fog">TRACKING</div>
                  <div className="font-display text-sm font-bold tracking-wide text-bone">
                    {active === "idle" ? "SCANNING…" : label(active).toUpperCase()}
                  </div>
                </div>
                <div className="border border-line bg-ink/70 px-2.5 py-2">
                  <div className="font-mono text-[10px] tracking-[0.18em] text-fog">AUTO-DETECT</div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-bold ${snap.detected === "idle" ? "text-fog" : "text-icecyan"}`}>
                      {label(snap.detected).toUpperCase()}
                    </span>
                    <span className="h-1.5 w-14 bg-panel2 relative overflow-hidden">
                      <span className="absolute inset-y-0 left-0 bg-icecyan transition-all duration-200"
                        style={{ width: `${Math.round(snap.confidence * 100)}%` }} />
                    </span>
                    <span className="font-mono text-[10px] text-fog">{Math.round(snap.confidence * 100)}%</span>
                  </div>
                </div>
              </div>

              {/* top-right: form lamp */}
              <div className={`absolute right-5 top-4 z-20 flex items-center gap-2 border bg-ink/80 px-3 py-2 ${lamp.cls}`}>
                <span className={`h-2 w-2 rounded-full ${lamp.dot}`} />
                <span className="font-mono text-[11px] font-bold tracking-[0.18em]">{lamp.txt}</span>
                <span className="font-mono text-[11px] text-mist">{tracking ? `${score}` : ""}</span>
              </div>

              {/* top-center: plank hold */}
              {isPlank && (
                <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 border border-volt/40 bg-ink/85 px-5 py-2 text-center">
                  <div className="font-mono text-[10px] tracking-[0.28em] text-fog">HOLD TARGET 01:00</div>
                  <div className="mt-1 h-1 w-40 bg-panel2">
                    <div className="h-full bg-volt transition-all duration-300"
                      style={{ width: `${Math.min(100, ((snap.plank.current % 60) / 60) * 100)}%` }} />
                  </div>
                </div>
              )}

              {/* bottom-left: the number */}
              <div className="absolute bottom-4 left-5 z-20">
                <div className="font-mono text-[10px] tracking-[0.28em] text-fog">
                  {isPlank ? "CURRENT HOLD" : isCounting ? `${label(active).toUpperCase()} REPS` : "VOLUME"}
                </div>
                <div key={snap.repFlash} className={`font-display font-black leading-none text-bone ${snap.repFlash ? "animate-pop" : ""}`}
                  style={{ fontSize: "clamp(56px, 9vw, 108px)", textShadow: tracking ? "0 0 34px rgba(198,242,53,0.28)" : "none" }}>
                  {bigValue}
                </div>
                <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-mist">
                  {isCounting && (
                    <>
                      <span className="text-volt">▲ {snap.phase}</span>
                      <span className="text-fog">{snap.cadence > 0 ? `${snap.cadence} REPS/MIN` : "CADENCE —"}</span>
                    </>
                  )}
                  {isPlank && (
                    <>
                      <span className={snap.plank.inPlank ? "text-volt" : "text-ambery"}>
                        {snap.plank.inPlank ? "● IN POSITION" : "○ OUT OF POSITION"}
                      </span>
                      <span className="text-fog">BEST {formatClock(snap.plank.best)}</span>
                    </>
                  )}
                  {active === "idle" && <span className="text-fog">MOVE INTO A PUSH-UP, SQUAT OR PLANK</span>}
                </div>
                {snap.lastRep && isCounting && (
                  <div className={`mt-2 inline-block border px-2 py-1 font-mono text-[11px] tracking-wider animate-feedin ${snap.lastRep.good ? "border-volt/50 text-volt" : "border-ambery/50 text-ambery"}`}>
                    LAST · {snap.lastRep.quality}
                  </div>
                )}
              </div>

              {/* bottom-right: live angles */}
              <div className="absolute bottom-4 right-5 z-20 text-right font-mono text-[11px] leading-5">
                <div className="border border-line bg-ink/75 px-3 py-2 text-left">
                  <div className="text-[9px] tracking-[0.25em] text-fog">JOINT TELEMETRY</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 text-mist">
                    <span>KNEE <b className="text-bone">{snap.angles.knee ?? "—"}°</b></span>
                    <span>ELBOW <b className="text-bone">{snap.angles.elbow ?? "—"}°</b></span>
                    <span>TRUNK <b className="text-bone">{snap.angles.hipLine ?? "—"}°</b></span>
                    <span>HIP Δ <b className={snap.angles.hipDev !== null && Math.abs(snap.angles.hipDev) > 0.12 ? "text-coral" : "text-bone"}>
                      {snap.angles.hipDev !== null ? (snap.angles.hipDev > 0 ? "+" : "") + snap.angles.hipDev : "—"}
                    </b></span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* tracking lost */}
          {live && !tracking && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/55">
              <div className="flex items-center gap-3 border border-ambery/50 bg-ink/90 px-5 py-3">
                <EyeIcon size={20} className="text-ambery" />
                <span className="font-mono text-xs tracking-[0.22em] text-ambery animate-blinker">
                  TRACKING LOST — STEP INTO FRAME
                </span>
              </div>
            </div>
          )}

          {/* standby veil */}
          {!live && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/72">
              <div className="text-center">
                <PulseIcon size={34} className="mx-auto text-line2" />
                <div className="mt-3 font-mono text-[11px] tracking-[0.3em] text-fog">
                  {status === "loading" ? "WAKING THE SKELETON ENGINE…" : status === "error" ? "SYSTEM FAULT" : "SENSOR STANDBY"}
                </div>
                {status === "loading" && (
                  <div className="mx-auto mt-3 h-0.5 w-40 overflow-hidden bg-panel2">
                    <div className="h-full w-1/3 bg-volt animate-[ticker_1.2s_linear_infinite]" />
                  </div>
                )}
                {status === "error" && (
                  <AlertIcon size={22} className="mx-auto mt-3 text-coral" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
