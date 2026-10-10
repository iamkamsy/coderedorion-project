"use client";

import Link from "next/link";
import type { SourceKind } from "@/audio/rack";
import type { BatcherStatus } from "@/lib/eventBatcher";
import type { CameraStatus } from "./Stage";

export type AudioState = "off" | "starting" | "on" | "error";
export type LayoutKind = "original" | "side" | "bottom";

const SOURCES: SegmentOption<SourceKind>[] = [
  { id: "loop", label: "Test loop", icon: <LoopIcon /> },
  { id: "mic", label: "Mic", title: "Microphone (use headphones)", icon: <MicIcon /> },
];

const LAYOUTS: SegmentOption<LayoutKind>[] = [
  { id: "original", label: "Original" },
  { id: "side", label: "Side panel" },
  { id: "bottom", label: "Bottom rack" },
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
  layout: LayoutKind;
  onLayoutChange: (layout: LayoutKind) => void;
}

const CAMERA_LABEL: Record<CameraStatus, { text: string; tone: string }> = {
  off: { text: "Camera off", tone: "bg-border" },
  requesting: { text: "Requesting camera", tone: "bg-warn" },
  "loading-model": { text: "Loading tracking", tone: "bg-warn" },
  ready: { text: "Tracking", tone: "bg-cool" },
  denied: { text: "Camera blocked", tone: "bg-danger" },
  error: { text: "Tracking failed", tone: "bg-danger" },
};

export function TopBar(props: Props) {
  const { audio, onStartAudio, source, onSourceChange, camera, dataConsent, onConsentChange, dbStatus, layout, onLayoutChange } = props;
  const cam = CAMERA_LABEL[camera];
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-white/[0.03] px-5 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold tracking-tight">Gesture Rack</span>
        <span className="hidden text-xs text-muted sm:inline">shape your sound with your hands</span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
        <Segmented label="Layout" options={LAYOUTS} value={layout} onChange={onLayoutChange} />

        <span className="flex items-center gap-2 text-muted">
          <span className={`size-2 rounded-full ${cam.tone}`} />
          {cam.text}
        </span>
        <span className="flex items-center gap-2 text-muted" title="Parameter events are streamed to Tiger Data about once per second">
          <span className={`size-2 rounded-full ${dbStatus === "ok" ? "bg-cool" : dbStatus === "offline" ? "bg-warn" : "bg-border"}`} />
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
            className="relative h-5 w-9 shrink-0 rounded-full border border-border bg-panel transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:rounded-full after:bg-text after:shadow after:transition-transform peer-checked:after:translate-x-4"
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
          className={`rounded-lg px-4 py-1.5 font-medium ${audio === "on" ? "bg-cool/15 text-cool" : "bg-accent text-text"} disabled:cursor-default`}
        >
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

/** Glass pill switch, used for every either/or choice in the top bar so they all match. */
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
    <div className="glass-inset flex rounded-full p-0.5 text-xs" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          title={o.title}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${value === o.id ? "bg-panel-raised text-text shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]" : "text-muted hover:text-text"}`}
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
