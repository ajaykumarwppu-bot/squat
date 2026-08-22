import { useCallback, useEffect, useRef, useState } from "react";
import { usePoseTracker } from "./hooks/usePoseTracker";
import Stage from "./components/Stage";
import Deck from "./components/Deck";
import StartGate from "./components/StartGate";
import { Header, Ticker, SignalChain, Footer } from "./components/Chrome";

const TARGET_KEY = "kinetiq.target.v1";

export default function App() {
  const {
    videoRef, canvasRef, status, error, ui, mode, lifetime,
    start, stop, setMode, resetCounts, announce,
  } = usePoseTracker();

  const [target, setTargetState] = useState<number>(() => {
    const raw = Number(localStorage.getItem(TARGET_KEY));
    return raw > 0 ? raw : 20;
  });
  const announcedRef = useRef("");

  const setTarget = useCallback((n: number) => {
    setTargetState(n);
    try { localStorage.setItem(TARGET_KEY, String(n)); } catch { /* ignore */ }
  }, []);

  // one-time callout when the active exercise hits the target
  useEffect(() => {
    if (!ui) return;
    const a = ui.snap.active;
    if (a !== "pushup" && a !== "squat") return;
    const n = ui.snap.reps[a];
    const key = `${a}-${target}`;
    if (target > 0 && n >= target && announcedRef.current !== key) {
      announcedRef.current = key;
      announce(`TARGET HIT — ${target} ${a === "pushup" ? "PUSH-UPS" : "SQUATS"} BANKED`, "good");
    }
  }, [ui, target, announce]);

  const live = status === "live";
  const snap = ui?.snap ?? null;

  return (
    <div className="min-h-screen font-body text-bone selection:bg-volt selection:text-ink">
      <Header status={status} fps={ui?.fps ?? 0} clock={snap?.clock ?? "00:00"} onStop={stop} />

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
        {/* live console — Stage stays mounted so the video element survives */}
        <div className={live ? "grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_370px]" : "hidden"}>
          <div className="animate-riseup">
            <Stage videoRef={videoRef} canvasRef={canvasRef} snap={snap} status={status} />
            {/* under-stage strip */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { k: "PHASE", v: snap?.phase ?? "—", c: "text-volt" },
                { k: "RANGE OF MOTION", v: snap ? `${Math.round(snap.phaseProgress * 100)}%` : "—", c: "text-icecyan" },
                { k: "FORM SCORE", v: snap ? `${snap.formScore}` : "—", c: snap && snap.formScore < 60 ? "text-coral" : "text-volt" },
                { k: "SESSION CLOCK", v: snap?.clock ?? "00:00", c: "text-bone" },
              ].map((s) => (
                <div key={s.k} className="border border-line bg-panel px-3 py-2.5">
                  <div className="font-mono text-[9px] tracking-[0.24em] text-fog">{s.k}</div>
                  <div className={`mt-0.5 font-display text-base font-bold ${s.c}`}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="animate-riseup" style={{ animationDelay: "0.12s" }}>
            <Deck
              snap={snap}
              mode={mode}
              onMode={setMode}
              onReset={() => { resetCounts(); announcedRef.current = ""; }}
              lifetime={lifetime}
              target={target}
              onTarget={setTarget}
              onAnnounce={announce}
            />
          </div>
        </div>

        {/* boot / standby / fault state */}
        {!live && (
          <div className="py-4 lg:py-10">
            <StartGate status={status} error={error} onStart={start} lifetime={lifetime} />
          </div>
        )}
      </main>

      <Ticker />
      <SignalChain />
      <Footer />
    </div>
  );
}
