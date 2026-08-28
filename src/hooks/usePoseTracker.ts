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

// Low-end default configuration
const CONFIG = {
  // Camera settings (low-end safe default)
  cameraWidth: 480,
  cameraHeight: 360,
  cameraFPS: 15,
  
  // Inference settings
  targetInferenceFPS: 6,  // AI runs at 6 FPS max on low-end
  minInferenceIntervalMs: 167, // 1000/6 ≈ 167ms
  
  // Canvas rendering (separate from camera resolution)
  canvasScale: 1.0,  // Scale factor for canvas (1.0 = same as camera)
  
  // Backend fallback
  preferBackend: "GPU" as "GPU" | "CPU",
  gpuErrorThreshold: 3,  // After 3 GPU errors, switch to CPU permanently
};

function loadLifetime(): Lifetime {
  try {
    const raw = localStorage.getItem(LIFETIME_KEY);
    if (raw) return { pushup: 0, squat: 0, plankSeconds: 0, sessions: 0, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { pushup: 0, squat: 0, plankSeconds: 0, sessions: 0 };
}

// Error throttling utility
const errorLogCache = new Map<string, number>();
function logOnce(key: string, fn: () => void, throttleMs = 3000) {
  const now = performance.now();
  const last = errorLogCache.get(key) || 0;
  if (now - last > throttleMs) {
    errorLogCache.set(key, now);
    fn();
  }
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
  
  // New state for inference control and error handling
  const isInferenceRunningRef = useRef(false);
  const lastInferenceTimeRef = useRef(0);
  const gpuErrorCountRef = useRef(0);
  const forceCPUBackendRef = useRef(false);
  const loopActiveRef = useRef(false);

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
    // Always recreate landmarker if backend changed
    if (landmarkerRef.current) {
      // Check if we need to recreate with different backend
      // For now, keep existing instance unless disposed
      return;
    }
    
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    
    // Determine backend: if GPU errors exceeded threshold, force CPU
    const delegate = forceCPUBackendRef.current ? "CPU" : CONFIG.preferBackend;
    
    const opts = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO" as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    
    try {
      landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, opts(delegate));
      logOnce("model-loaded", () => console.log(`Pose model loaded with ${delegate} backend`));
    } catch (gpuErr) {
      logOnce("gpu-fallback", () => console.warn("GPU backend failed, falling back to CPU"));
      forceCPUBackendRef.current = true;
      landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, opts("CPU"));
    }
  }, []);

  const pickSide = (lm: Pt[], left: number, right: number) =>
    (lm[left].visibility ?? 0) >= (lm[right].visibility ?? 0) ? left : right;

  const loop = useCallback(() => {
    // Guard: prevent multiple simultaneous loops
    if (!loopActiveRef.current || !runningRef.current) return;
    
    rafRef.current = requestAnimationFrame(loop);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    
    if (!video || !canvas || !landmarker || video.readyState < 2) return;
    
    // Emergency brake: stop inference if GPU errors exceeded threshold
    if (gpuErrorCountRef.current >= CONFIG.gpuErrorThreshold && forceCPUBackendRef.current) {
      logOnce("emergency-stop", () => {
        console.warn("Emergency stop: Too many GPU errors. Please restart tracking.");
      });
      // Don't keep calling detectForVideo - just render with last known state
      const engine = engineRef.current;
      const snap = engine.update(lastLmRef.current, performance.now());
      const ctx = canvas.getContext("2d");
      if (ctx) {
        drawScene(ctx, {
          lm: lastLmRef.current,
          w: canvas.width,
          h: canvas.height,
          t: performance.now(),
          tracking: "lost",
          arc: null,
          align: null,
          trail: trailRef.current,
          keyJoints: [],
          issueActive: false,
        });
      }
      return;
    }
    
    const t0 = performance.now();
    
    // Frame skipping: skip inference if too soon since last one
    const timeSinceLastInference = t0 - lastInferenceTimeRef.current;
    if (timeSinceLastInference < CONFIG.minInferenceIntervalMs) {
      // Skip inference but still render with last known landmarks
      const engine = engineRef.current;
      const snap = engine.update(lastLmRef.current, t0);
      
      // Draw with existing landmarks
      const ctx = canvas.getContext("2d");
      if (ctx) {
        drawScene(ctx, {
          lm: lastLmRef.current,
          w: canvas.width,
          h: canvas.height,
          t: t0,
          tracking: snap.tracking,
          arc: null,
          align: null,
          trail: trailRef.current,
          keyJoints: [],
          issueActive: false,
        });
      }
      
      // Throttled UI update
      if (t0 - ((loop as any)._ui || 0) > 150) {
        (loop as any)._ui = t0;
        setUi({ snap, fps: Math.round(Math.min(99, fpsRef.current)) });
      }
      return;
    }
    
    // Guard: prevent overlapping inference calls
    if (isInferenceRunningRef.current) {
      return; // Skip this frame, inference already running
    }
    
    isInferenceRunningRef.current = true;
    lastInferenceTimeRef.current = t0;
    
    let lm: Pt[] | null = null;
    
    try {
      // Set canvas size based on video (low-resolution for performance)
      const targetWidth = Math.min(video.videoWidth || CONFIG.cameraWidth, CONFIG.cameraWidth);
      const targetHeight = Math.min(video.videoHeight || CONFIG.cameraHeight, CONFIG.cameraHeight);
      
      // Skip if video dimensions are not yet available
      if (targetWidth <= 0 || targetHeight <= 0) {
        return;
      }
      
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      
      // Run pose detection with proper error handling
      const res = landmarker.detectForVideo(video, t0);
      lm = (res && res.landmarks && res.landmarks[0]) || null;
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
      fpsRef.current = fpsRef.current * 0.92 + (1000 / Math.max(1, t0 - ((loop as any)._prev || t0 - 16))) * 0.08;
      (loop as any)._prev = t0;
      if (t0 - ((loop as any)._ui || 0) > 100) {
        (loop as any)._ui = t0;
        setUi({ snap, fps: Math.round(Math.min(99, fpsRef.current)) });
      }
      
    } catch (err: any) {
      // Handle inference errors gracefully
      gpuErrorCountRef.current++;
      
      logOnce("inference-error", () => {
        console.warn(`Inference error (${gpuErrorCountRef.current}/${CONFIG.gpuErrorThreshold}):`, err?.message || err);
      });
      
      // If GPU errors exceed threshold, force CPU backend permanently
      if (gpuErrorCountRef.current >= CONFIG.gpuErrorThreshold) {
        logOnce("gpu-threshold", () => {
          console.warn("GPU error threshold exceeded. Switching to CPU backend permanently.");
        });
        forceCPUBackendRef.current = true;
        
        // Stop the current loop and require restart with CPU backend
        runningRef.current = false;
        cancelAnimationFrame(rafRef.current);
        isInferenceRunningRef.current = false;
        
        setStatus("error");
        setError("GPU backend failed. Please click 'Start Tracking' again to use CPU backend.");
        return;
      }
      
      // Continue the loop but skip processing for this frame
      // The engine will handle missing landmarks gracefully on next successful frame
    } finally {
      isInferenceRunningRef.current = false;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("loading");
    
    // Reset state flags (but NOT forceCPUBackendRef - keep it if already set)
    loopActiveRef.current = true;
    isInferenceRunningRef.current = false;
    lastInferenceTimeRef.current = 0;
    gpuErrorCountRef.current = 0;
    
    try {
      // Recreate landmarker if backend changed
      if (landmarkerRef.current && forceCPUBackendRef.current) {
        // Need to recreate with CPU backend
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
      await ensureModel();
      
      // Request low-resolution camera stream for better performance on low-end devices
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: CONFIG.cameraWidth },
          height: { ideal: CONFIG.cameraHeight },
          frameRate: { ideal: CONFIG.cameraFPS, max: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("video element missing");
      video.srcObject = stream;
      
      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Video initialization timeout")), 10000);
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Video element error"));
        };
      });
      
      await video.play();
      runningRef.current = true;
      
      // Cancel any existing animation frame
      cancelAnimationFrame(rafRef.current);
      (loop as any)._prev = performance.now();
      (loop as any)._ui = 0;
      
      // Start the animation loop
      rafRef.current = requestAnimationFrame(loop);
      setStatus("live");
      
      window.clearInterval(persistTimerRef.current);
      persistTimerRef.current = window.setInterval(persistLifetime, 15000);
      
      logOnce("tracking-started", () => {
        const backend = forceCPUBackendRef.current ? "CPU" : "GPU";
        console.log(`Tracking started: ${CONFIG.cameraWidth}x${CONFIG.cameraHeight} @ ${CONFIG.cameraFPS}fps, AI @ ${CONFIG.targetInferenceFPS}fps, backend=${backend}`);
      });
    } catch (err: any) {
      runningRef.current = false;
      loopActiveRef.current = false;
      
      const name = err?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Camera access was denied. KINETIQ needs the camera to see your skeleton — allow it in the browser bar, then retry.");
      } else if (name === "NotFoundError") {
        setError("No camera found on this device. Plug one in and retry.");
      } else if (name === "TimeoutError" || err?.message?.includes("timeout")) {
        setError("Camera initialization timed out. Try refreshing the page and retry.");
      } else {
        setError(`Startup failed: ${err?.message ?? "unknown error"}. Check your connection (the pose model loads once from CDN) and retry.`);
      }
      setStatus("error");
    }
  }, [ensureModel, loop, persistLifetime]);

  const stop = useCallback(() => {
    runningRef.current = false;
    loopActiveRef.current = false;
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
    isInferenceRunningRef.current = false;
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
      loopActiveRef.current = false;
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      window.clearInterval(persistTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      isInferenceRunningRef.current = false;
    };
  }, []);

  return {
    videoRef, canvasRef, status, error, ui, mode, lifetime,
    start, stop, setMode, resetCounts, announce,
  };
}
