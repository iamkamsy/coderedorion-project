"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HandTracker, TrackerFrame } from "@/gesture/tracker";
import { DEFAULT_CALIBRATION, normalizePinch, type Calibration } from "@/gesture/pinch";
import { GESTURES, type Gesture, type GestureValues } from "@/mapping/types";
import { GESTURE_LABEL } from "@/lib/format";

export type InputMode = "camera" | "fake";
export type CameraStatus = "off" | "requesting" | "loading-model" | "ready" | "denied" | "error";

export interface Chip {
  label: string;
  value: string;
}

interface Props {
  inputMode: InputMode;
  onInputModeChange: (mode: InputMode) => void;
  onCameraStatus: (status: CameraStatus) => void;
  /** Camera-derived values. Called every tracked frame. */
  onTracked: (values: GestureValues) => void;
  /** Called whenever a tracked frame shows an open palm. Used as a hands-free panic stop. */
  onOpenHand: () => void;
  fakeValues: Record<Gesture, number>;
  onFakeChange: (gesture: Gesture, value: number) => void;
  values: GestureValues;
  chips: Record<Gesture, Chip[]>;
  /** When true the camera fills the screen, leaving a thin border of background. */
  expanded: boolean;
  onToggleExpand: () => void;
}

type CalStep = null | "closed" | "open";
const CAL_KEY = "gesture-rack.calibration";
const CAL_SAMPLE_MS = 1500;
/** How long an open palm must be held before it triggers the panic stop, so a passing relax doesn't trip it. */
const OPEN_HAND_HOLD_MS = 2000;

function loadCalibration(): Calibration {
  try {
    const raw = localStorage.getItem(CAL_KEY);
    if (raw) {
      const c = JSON.parse(raw) as Calibration;
      if (Number.isFinite(c.closed) && Number.isFinite(c.open) && c.open > c.closed) return c;
    }
  } catch {}
  return DEFAULT_CALIBRATION;
}

export function Stage(props: Props) {
  const {
    inputMode,
    onInputModeChange,
    onCameraStatus,
    onTracked,
    onOpenHand,
    fakeValues,
    onFakeChange,
    values,
    chips,
    expanded,
    onToggleExpand,
  } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const connectionsRef = useRef<{ start: number; end: number }[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const calRef = useRef<Calibration>(DEFAULT_CALIBRATION);
  const samplesRef = useRef<number[]>([]);
  const calStepRef = useRef<CalStep>(null);
  /** Last live (non-frozen) value per gesture, held steady while that hand's pinky is stuck out. */
  const heldValuesRef = useRef<GestureValues>({ pinch_left: null, pinch_right: null });
  /** Timestamp an open palm was first seen this streak, or null when no hand is currently open. */
  const openSinceRef = useRef<number | null>(null);

  const [status, setStatus] = useState<CameraStatus>("off");
  const [anchors, setAnchors] = useState<Partial<Record<Gesture, { x: number; y: number }>>>({});
  const [calStep, setCalStep] = useState<CalStep>(null);
  const [dragging, setDragging] = useState(false);

  const updateStatus = useCallback(
    (s: CameraStatus) => {
      setStatus(s);
      onCameraStatus(s);
    },
    [onCameraStatus],
  );

  useEffect(() => {
    calRef.current = loadCalibration();
  }, []);

  const handleFrame = useCallback(
    (frame: TrackerFrame) => {
      const next: GestureValues = { pinch_left: null, pinch_right: null };
      const nextAnchors: Partial<Record<Gesture, { x: number; y: number }>> = {};
      let anyOpen = false;
      for (const hand of frame.hands) {
        const live = normalizePinch(hand.ratio, calRef.current);
        const held = heldValuesRef.current[hand.gesture];
        if (hand.pinkyExtended && held !== null) {
          next[hand.gesture] = held;
        } else {
          next[hand.gesture] = live;
          heldValuesRef.current[hand.gesture] = live;
        }
        nextAnchors[hand.gesture] = { x: 1 - hand.landmarks[8].x, y: hand.landmarks[8].y };
        if (calStepRef.current) samplesRef.current.push(hand.ratio);
        if (hand.isOpen) anyOpen = true;
      }
      setAnchors(nextAnchors);
      onTracked(next);
      // Only outside calibration, so holding an open palm to sample "open" during pinch calibration can't also stop audio.
      if (anyOpen && !calStepRef.current) {
        if (openSinceRef.current === null) openSinceRef.current = frame.timestamp;
        // Require the hold, not just a momentary open palm, so relaxing the hand mid-pinch doesn't trip it.
        if (frame.timestamp - openSinceRef.current >= OPEN_HAND_HOLD_MS) onOpenHand();
      } else {
        openSinceRef.current = null;
      }
      drawOverlay(canvasRef.current, videoRef.current, frame, connectionsRef.current);
    },
    [onTracked, onOpenHand],
  );

  const stopCamera = useCallback(() => {
    trackerRef.current?.dispose();
    trackerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    updateStatus("requesting");
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      updateStatus(denied ? "denied" : "error");
      onInputModeChange("fake");
      return;
    }
    video.srcObject = streamRef.current;
    await video.play().catch(() => {});

    updateStatus("loading-model");
    try {
      const mod = await import("@/gesture/tracker");
      connectionsRef.current = mod.HAND_CONNECTIONS;
      trackerRef.current = await mod.HandTracker.create();
      trackerRef.current.start(video, handleFrame);
      updateStatus("ready");
      onInputModeChange("camera");
    } catch {
      stopCamera();
      updateStatus("error");
      onInputModeChange("fake");
    }
  }, [handleFrame, onInputModeChange, stopCamera, updateStatus]);

  useEffect(() => stopCamera, [stopCamera]);

  const runCalibration = useCallback(async () => {
    const collect = async (step: Exclude<CalStep, null>) => {
      samplesRef.current = [];
      calStepRef.current = step;
      setCalStep(step);
      await new Promise((r) => setTimeout(r, CAL_SAMPLE_MS));
      const s = [...samplesRef.current].sort((a, b) => a - b);
      return s.length ? s[Math.floor(s.length / 2)] : null;
    };
    const closed = await collect("closed");
    const open = await collect("open");
    calStepRef.current = null;
    setCalStep(null);
    if (closed !== null && open !== null && open - closed > 0.2) {
      calRef.current = { closed, open };
      try {
        localStorage.setItem(CAL_KEY, JSON.stringify(calRef.current));
      } catch {}
    }
  }, []);

  const onPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inputMode !== "fake" || !dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const v = 1 - (e.clientY - rect.top) / rect.height;
    onFakeChange("pinch_right", Math.min(1, Math.max(0, v)));
  };

  const cameraLive = status === "ready" && inputMode === "camera";
  const noHands = cameraLive && values.pinch_left === null && values.pinch_right === null;

  return (
    <section className="flex shrink-0 flex-col gap-3" aria-label="Camera stage" data-tour="stage">
      <div
        className={`${expanded ? "fixed inset-x-4 top-20 bottom-4 z-30" : "relative aspect-video w-full shrink-0"} overflow-hidden rounded-[var(--radius-panel)] glass transition-[outline-color] duration-300 ${inputMode === "fake" ? "cursor-ns-resize" : ""} ${dragging || cameraLive ? "stage-live" : ""}`}
        onPointerDown={(e) => {
          if (inputMode !== "fake" || (e.target as HTMLElement).closest("button")) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerMove={onPointer}
      >
        <video ref={videoRef} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" playsInline muted />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover" />

        {cameraLive &&
          GESTURES.map((g) => {
            const a = anchors[g];
            if (!a || chips[g].length === 0) return null;
            return (
              <div
                key={g}
                className="pointer-events-none absolute flex -translate-y-full flex-col gap-1 pb-3"
                style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
              >
                {chips[g].map((c) => (
                  <span key={c.label} className="rounded-full bg-black/70 px-2.5 py-0.5 font-mono text-xs text-white backdrop-blur-xl">
                    {c.label} {c.value}
                  </span>
                ))}
              </div>
            );
          })}

        <StageOverlay status={status} inputMode={inputMode} noHands={noHands} calStep={calStep} onEnable={startCamera} />

        <div className="pointer-events-none absolute bottom-3 left-3 flex gap-2">
          {GESTURES.map((g) => (
            <PinchMeter key={g} label={GESTURE_LABEL[g]} value={values[g]} />
          ))}
        </div>

        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? "Exit full view" : "Expand camera"}
          title={expanded ? "Exit full view (Esc)" : "Expand camera"}
          className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-xl transition-colors hover:bg-black/65"
        >
          <svg
            viewBox="0 0 20 20"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {expanded ? <path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" /> : <path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" />}
          </svg>
        </button>
      </div>

      <div
        className={`flex flex-wrap items-center gap-3 rounded-[var(--radius-panel)] glass px-4 py-3 text-sm ${expanded ? "hidden" : ""}`}
      >
        <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Input mode">
          {(["camera", "fake"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={m === "camera" && status !== "ready"}
              onClick={() => onInputModeChange(m)}
              className={`rounded-md px-3 py-1 transition-colors disabled:opacity-40 ${inputMode === m ? "bg-panel-raised text-text" : "text-muted hover:text-text"}`}
            >
              {m === "camera" ? "Camera" : "Fake pinch"}
            </button>
          ))}
        </div>
        {inputMode === "fake" ? (
          GESTURES.map((g) => (
            <label key={g} className="flex items-center gap-2 text-muted">
              {GESTURE_LABEL[g]}
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={fakeValues[g]}
                onChange={(e) => onFakeChange(g, Number(e.target.value))}
                className="w-28"
              />
            </label>
          ))
        ) : (
          <button
            type="button"
            onClick={runCalibration}
            disabled={calStep !== null}
            className="rounded-lg border border-border px-3 py-1 text-muted hover:text-text disabled:opacity-50"
          >
            {calStep ? "Calibrating..." : "Calibrate pinch"}
          </button>
        )}{" "}
      </div>
    </section>
  );
}

function StageOverlay({
  status,
  inputMode,
  noHands,
  calStep,
  onEnable,
}: {
  status: CameraStatus;
  inputMode: InputMode;
  noHands: boolean;
  calStep: CalStep;
  onEnable: () => void;
}) {
  let title: string | null = null;
  let body: string | null = null;
  let action: React.ReactNode = null;

  if (calStep === "closed") {
    title = "Pinch closed";
    body = "Touch thumb and index finger together and hold.";
  } else if (calStep === "open") {
    title = "Now open wide";
    body = "Spread thumb and index finger as far as is comfortable.";
  } else if (inputMode === "fake") {
    if (status === "off") {
      title = "Camera is off";
      body = "Enable the camera to control effects with your hands, or drag up and down here to fake a pinch.";
      action = (
        <button
          type="button"
          onClick={onEnable}
          className="pointer-events-auto mt-3 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-on-ink"
        >
          Enable camera
        </button>
      );
    } else if (status === "denied") {
      title = "Camera access was blocked";
      body = "Allow the camera in your browser's site settings, then reload. Fake pinch is active: drag up and down here.";
    } else if (status === "error") {
      title = "Hand tracking unavailable";
      body = "The camera or model failed to load. Fake pinch is active: drag up and down here.";
    } else {
      body = "Fake pinch: drag up and down on the stage.";
    }
  } else if (status === "requesting") {
    title = "Waiting for camera permission";
  } else if (status === "loading-model") {
    title = "Loading hand tracking";
    body = "This takes a few seconds the first time.";
  } else if (noHands) {
    title = "Show a hand to the camera";
    body = "Pinch thumb and index finger, then open them.";
  }

  if (!title && !body) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm rounded-2xl border border-white/15 bg-[rgb(18_18_20/0.82)] px-5 py-4 text-center text-[#f5f5f7] shadow-[0_16px_40px_-12px_rgb(0_0_0/0.6)] backdrop-blur-2xl">
        {/* Always a solid dark card so it stays readable over live video, whatever the box style. */}
        {title && <p className="font-medium">{title}</p>}
        {body && <p className="mt-1 text-sm text-muted">{body}</p>}
        {action}
      </div>
    </div>
  );
}

function PinchMeter({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/40 bg-white/40 px-3 py-1.5 text-[#111] backdrop-blur-xl">
      <span className="text-xs font-medium text-black/70">{label}</span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-black/15">
        <div className="h-full bg-accent" style={{ width: `${(value ?? 0) * 100}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-xs font-semibold">{value === null ? "--" : value.toFixed(2)}</span>
    </div>
  );
}

function drawOverlay(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement | null,
  frame: TrackerFrame,
  connections: { start: number; end: number }[],
) {
  if (!canvas || !video) return;
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const tokens = getComputedStyle(document.documentElement);

  for (const hand of frame.hands) {
    const lm = hand.landmarks;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const c of connections) {
      ctx.moveTo(lm[c.start].x * w, lm[c.start].y * h);
      ctx.lineTo(lm[c.end].x * w, lm[c.end].y * h);
    }
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = tokens.getPropertyValue("--accent").trim();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(lm[4].x * w, lm[4].y * h);
    ctx.lineTo(lm[8].x * w, lm[8].y * h);
    ctx.stroke();
  }
}
