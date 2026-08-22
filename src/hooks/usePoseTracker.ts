import { useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { ExerciseEngine, EngineSnapshot, Mode } from "../lib/engine";
import { drawScene, ArcTone } from "../lib/draw";
import { Pt } from "../lib/geometry";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export type TrackerStatus = "boot" | "loading" | "live" | "stopped" | "error";

export interface Lifetime {
  pushup: number;
  squat: number;
  plankSeconds: number;
  sessions: number;
}

const LIFETIME_KEY = "kinetiq.lifetime.v1";

function loadLifetime(): Lifetime {
  try {
    const raw = localStorage.getItem(LIFETIME_KEY);
    if (raw) return { pushup: 0, squat: 0, plankSeconds: 0, sessions: 0, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { pushup: 0, squat: 0, plankSeconds: 0, sessions: 0 };
}

export function usePoseTracker() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ExerciseEngine>(new ExerciseEngine());
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastLmRef = useRef<Pt[] | null>(null);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const fpsRef = useRef(60);
  const persistTimerRef = useRef(0);
  const runningRef = useRef(false);
  const lastRepsRef = useRef({ pushup: 0, squat: 0, plank: 0 });

  const [status, setStatus] = useState<TrackerStatus>("boot");
  const [error, setError] = useState<string | null>(null);
  const [mode, setModeState] = useState<Mode>("auto");
  const [lifetime, setLifetime] = useState<Lifetime>(loadLifetime);
  const [ui, setUi] = useState<{ snap: EngineSnapshot; fps: number } | null>(null);

  const persistLifetime = useCallback(() => {
    const e = engineRef.current;
    setLifetime((prev) => {
      const next: Lifetime = {
        pushup: prev.pushup + Math.max(0, e.repsSnapshot().pushup - lastRepsRef.current.pushup),
        squat: prev.squat + Math.max(0, e.repsSnapshot().squat - lastRepsRef.current.squat),
        plankSeconds: prev.plankSeconds + Math.max(0, Math.floor(e.plankSnapshot().total) - lastRepsRef.current.plank),
        sessions: prev.sessions,
      };
      lastRepsRef.current = {
        pushup: e.repsSnapshot().pushup,
        squat: e.repsSnapshot().squat,
        plank: Math.floor(e.plankSnapshot().total),
      };
      try { localStorage.setItem(LIFETIME_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const ensureModel = useCallback(async () => {
    if (landmarkerRef.current) return;
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    const opts = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO" as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, opts("GPU"));
    } catch {
      landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, opts("CPU"));
    }
  }, []);

  const pickSide = (lm: Pt[], left: number, right: number) =>
    (lm[left].visibility ?? 0) >= (lm[right].visibility ?? 0) ? left : right;

  const loop = useCallback(() => {
    rafRef.current = requestAnimationFrame(loop);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || video.readyState < 2) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
    }

    const t0 = performance.now();
    const res = landmarker.detectForVideo(video, t0);
    const lm = (res.landmarks && res.landmarks[0]) || null;
    lastLmRef.current = lm;

    const engine = engineRef.current;
    const snap = engine.update(lm, t0);

    // motion trail point
    if (lm && snap.tracking) {
      let pt: Pt | null = null;
      if (snap.active === "squat") {
        const h1 = lm[23], h2 = lm[24];
        pt = { x: (h1.x + h2.x) / 2, y: (h1.y + h2.y) / 2, z: 0 };
      } else if (snap.active === "pushup") {
        pt = lm[pickSide(lm, 15, 16)];
      }
      if (pt) trailRef.current.push({ x: pt.x, y: pt.y });
    }
    if (trailRef.current.length > 26) trailRef.current.splice(0, trailRef.current.length - 26);
    if (!snap.tracking || snap.active === "plank" || snap.active === "idle") {
      if (trailRef.current.length) trailRef.current.splice(0, 2);
    }

    // draw options derived from snapshot
    let arc: Parameters<typeof drawScene>[1]["arc"] = null;
    let align: Parameters<typeof drawScene>[1]["align"] = null;
    let keyJoints: number[] = [];
    let tone: ArcTone = "mist";
    const bad = snap.issues.some((i) => i.severity === "bad");
    if (lm && snap.tracking) {
      if (snap.active === "squat") {
        const s = pickSide(lm, 23, 24);
        const side = s === 23 ? [23, 25, 27] : [24, 26, 28];
        keyJoints = [25, 26];
        tone = bad ? "coral" : snap.phase === "IN THE HOLE" ? "volt" : snap.phase === "DESCENT" ? "amber" : "mist";
        arc = {
          joint: side as [number, number, number],
          angle: snap.angles.knee ?? 180,
          tone,
          label: `${snap.angles.knee ?? "—"}°`,
        };
      } else if (snap.active === "pushup") {
        const s = pickSide(lm, 11, 12);
        const side = s === 11 ? [11, 13, 15] : [12, 14, 16];
        keyJoints = [13, 14];
        tone = bad ? "coral" : snap.phase === "BOTTOM" ? "volt" : "mist";
        arc = {
          joint: side as [number, number, number],
          angle: snap.angles.elbow ?? 180,
          tone,
          label: `${snap.angles.elbow ?? "—"}°`,
        };
        align = { a: s, c: s === 11 ? 27 : 28, p: s === 11 ? 23 : 24, dev: snap.angles.hipDev ?? 0 };
      } else if (snap.active === "plank") {
        const s = pickSide(lm, 11, 12);
        keyJoints = [11, 12, 23, 24];
        align = { a: s, c: s === 11 ? 27 : 28, p: s === 11 ? 23 : 24, dev: snap.angles.hipDev ?? 0 };
      }
    }

    const ctx = canvas.getContext("2d");
    if (ctx) {
      drawScene(ctx, {
        lm,
        w: canvas.width,
        h: canvas.height,
        t: t0,
        tracking: snap.tracking,
        arc,
        align,
        trail: trailRef.current,
        keyJoints,
        issueActive: bad,
      });
    }

    // fps + throttled UI sync
    const inst = 1000 / Math.max(1, performance.now() - t0 + 0.001);
    void inst;
    fpsRef.current = fpsRef.current * 0.92 + (1000 / Math.max(1, t0 - (loop as any)._prev || 16)) * 0.08;
    (loop as any)._prev = t0;
    if (t0 - ((loop as any)._ui || 0) > 100) {
      (loop as any)._ui = t0;
      setUi({ snap, fps: Math.round(Math.min(99, fpsRef.current)) });
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("loading");
    try {
      await ensureModel();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("video element missing");
      video.srcObject = stream;
      await video.play();
      runningRef.current = true;
      cancelAnimationFrame(rafRef.current);
      (loop as any)._prev = performance.now();
      rafRef.current = requestAnimationFrame(loop);
      setStatus("live");
      window.clearInterval(persistTimerRef.current);
      persistTimerRef.current = window.setInterval(persistLifetime, 15000);
    } catch (err: any) {
      runningRef.current = false;
      const name = err?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Camera access was denied. KINETIQ needs the camera to see your skeleton — allow it in the browser bar, then retry.");
      } else if (name === "NotFoundError") {
        setError("No camera found on this device. Plug one in and retry.");
      } else {
        setError(`Startup failed: ${err?.message ?? "unknown error"}. Check your connection (the pose model loads once from CDN) and retry.`);
      }
      setStatus("error");
    }
  }, [ensureModel, loop, persistLifetime]);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    window.clearInterval(persistTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    const e = engineRef.current;
    if (e.totalVolume() > 0) {
      setLifetime((prev) => {
        const next = { ...prev, sessions: prev.sessions + 1 };
        try { localStorage.setItem(LIFETIME_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    }
    persistLifetime();
    setUi(null);
    lastLmRef.current = null;
    trailRef.current = [];
    setStatus("stopped");
  }, [persistLifetime]);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    engineRef.current.setMode(m);
  }, []);

  const resetCounts = useCallback(() => {
    engineRef.current.resetCounts();
    lastRepsRef.current = { pushup: 0, squat: 0, plank: 0 };
  }, []);

  const announce = useCallback((msg: string, tone?: "good" | "warn" | "bad" | "info") => {
    engineRef.current.announce(msg, tone ?? "info");
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearInterval(persistTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    videoRef, canvasRef, status, error, ui, mode, lifetime,
    start, stop, setMode, resetCounts, announce,
  };
}
