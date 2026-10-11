"use client";

import Link from "next/link";
import type { SourceKind } from "@/audio/rack";
import type { BatcherStatus } from "@/lib/eventBatcher";
import { PinchGlyph } from "./PinchGlyph";
import type { CameraStatus } from "./Stage";

export type AudioState = "off" | "starting" | "on" | "error";
export type SurfaceKind = "tinted" | "graphite";

const SOURCES: SegmentOption<SourceKind>[] = [
  { id: "loop", label: "Test loop", icon: <LoopIcon /> },
  { id: "mic", label: "Mic", title: "Microphone (use headphones)", icon: <MicIcon /> },
];

const SURFACES: SegmentOption<SurfaceKind>[] = [
  { id: "tinted", label: "Tinted", title: "Smoky glass boxes, matching the effects dock" },
  { id: "graphite", label: "Graphite", title: "Deep grey glass boxes, like a softer black dock" },
];

interface Props {
  audio: AudioState;
  onStartAudio: () => void;
  source: SourceKind;
  onSourceChange: (s: SourceKind) => void;
  camera: CameraStatus;
  dataConsent: boolean;
  onConsentChange: (v: boolean) => void;
  dbStatus: BatcherStatus;
  surface: SurfaceKind;
  onSurfaceChange: (surface: SurfaceKind) => void;
}

const CAMERA_LABEL: Record<CameraStatus, { text: string; tone: string }> = {
  off: { text: "Camera off", tone: "bg-muted/40" },
  requesting: { text: "Requesting camera", tone: "bg-warn" },
  "loading-model": { text: "Loading tracking", tone: "bg-warn" },
  ready: { text: "Tracking", tone: "bg-accent" },
  denied: { text: "Camera blocked", tone: "bg-danger" },
  error: { text: "Tracking failed", tone: "bg-danger" },
};

export function TopBar(props: Props) {
  const { audio, onStartAudio, source, onSourceChange, camera, dataConsent, onConsentChange, dbStatus, surface, onSurfaceChange } = props;
  const cam = CAMERA_LABEL[camera];
  return (
    <header className="glass sticky top-3 z-30 mx-3 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl p-2 pl-2.5 sm:mx-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]">
          <PinchGlyph />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">Gesture Rack</span>{" "}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
        <Segmented label="Box style" options={SURFACES} value={surface} onChange={onSurfaceChange} />

        <span className="flex items-center gap-2 text-muted">
          <span className={`size-2 rounded-full ${cam.tone}`} />
          {cam.text}
        </span>
        <span className="flex items-center gap-2 text-muted" title="Parameter events are streamed to Tiger Data about once per second">
          <span className={`size-2 rounded-full ${dbStatus === "ok" ? "bg-accent" : dbStatus === "offline" ? "bg-warn" : "bg-muted/40"}`} />
          {dbStatus === "offline" ? "Data offline" : "Data stream"}
        </span>

        <Segmented label="Audio source" options={SOURCES} value={source} onChange={onSourceChange} />

        <label
          className="flex cursor-pointer items-center gap-2 text-muted"
          title="Off by default. When on, your intent text and effect descriptions may be stored to improve mappings."
        >
          <input
            type="checkbox"
            role="switch"
            checked={dataConsent}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-5 w-9 shrink-0 rounded-full border border-border bg-black/10 transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
          />
          Share data
        </label>

        <Link href="/dashboard" className="text-muted hover:text-text">
          Dashboard
        </Link>

        <button
          type="button"
          onClick={onStartAudio}
          disabled={audio === "starting" || audio === "on"}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold disabled:cursor-default ${audio === "on" ? "bg-panel-raised text-text" : "bg-ink text-on-ink"}`}
        >
          {audio === "on" ? (
            <span className="size-2 rounded-full bg-accent shadow-[0_0_6px_var(--accent)]" aria-hidden />
          ) : (
            <svg viewBox="0 0 20 20" className="size-3" fill="currentColor" aria-hidden>
              <path d="M6 3.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7Z" />
            </svg>
          )}
          {audio === "on" ? "Audio on" : audio === "starting" ? "Starting..." : audio === "error" ? "Retry audio" : "Start audio"}
        </button>
      </div>
    </header>
  );
}

interface SegmentOption<T extends string> {
  id: T;
  label: string;
  title?: string;
  icon?: React.ReactNode;
}

/** iOS-style segmented pill switch, used for every either/or choice in the top bar so they all match. */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-full bg-black/[0.06] p-0.5 text-xs" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          title={o.title}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${value === o.id ? "bg-white font-medium text-text shadow-[0_1px_3px_rgb(0_0_0/0.14)]" : "text-muted hover:text-text"}`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LoopIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 8a4 4 0 0 1 4-4h6l-2-2M16 12a4 4 0 0 1-4 4H6l2 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="7" y="2.5" width="6" height="10" rx="3" />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" strokeLinecap="round" />
    </svg>
  );
}
