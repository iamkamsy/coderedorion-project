"use client";

import Link from "next/link";
import { SOURCE_LABEL, type SourceKind } from "@/audio/inputs";
import type { BatcherStatus } from "@/lib/eventBatcher";
import { HomeButton } from "./HomeButton";
import type { CameraStatus } from "./Stage";

export type AudioState = "off" | "starting" | "on" | "error";
export type SurfaceKind = "tinted" | "graphite";

const SOURCES: SegmentOption<SourceKind>[] = [
  { id: "loop", label: "Test loop", title: SOURCE_LABEL.loop, icon: <LoopIcon /> },
  { id: "mic", label: "Mic", title: `${SOURCE_LABEL.mic}: speech noise suppression on. Use headphones.`, icon: <MicIcon /> },
  { id: "line", label: "Line in", title: `${SOURCE_LABEL.line}: raw signal for guitar or an audio interface.`, icon: <LineIcon /> },
];

const SURFACES: SegmentOption<SurfaceKind>[] = [
  { id: "tinted", label: "Tinted", title: "Smoky glass boxes, matching the effects dock" },
  { id: "graphite", label: "Graphite", title: "Deep grey glass boxes, like a softer black dock" },
];

interface Props {
  audio: AudioState;
  onStartAudio: () => void;
  stopped: boolean;
  onToggleStop: () => void;
  source: SourceKind;
  onSourceChange: (s: SourceKind) => void;
  camera: CameraStatus;
  dbStatus: BatcherStatus;
  surface: SurfaceKind;
  onSurfaceChange: (surface: SurfaceKind) => void;
  /** Set inside a lesson playground. */
  lesson?: { number: number; title: string };
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
  const { audio, onStartAudio, stopped, onToggleStop, source, onSourceChange, camera, dbStatus, surface, onSurfaceChange, lesson } = props;
  const cam = CAMERA_LABEL[camera];
  return (
    <header className="glass sticky top-3 z-30 mx-3 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl p-2 pl-2.5 sm:mx-4">
      <div className="flex items-center gap-2.5">
        <HomeButton />
        {lesson ? (
          <nav className="flex items-baseline gap-2" aria-label="Breadcrumb">
            <Link href="/learn" className="text-[13px] text-muted hover:text-text">
              ← Lessons
            </Link>
            <span className="text-[15px] font-semibold tracking-tight">
              <span className="text-muted">{lesson.number}.</span> {lesson.title}
            </span>
          </nav>
        ) : (
          <span className="text-[15px] font-semibold tracking-tight">Gesture Labs</span>
        )}
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

        {!lesson && (
          <Link href="/learn" className="font-semibold text-accent-text hover:text-text">
            Learn
          </Link>
        )}
        <Link href="/dashboard" className="text-muted hover:text-text">
          Dashboard
        </Link>

        {audio === "on" ? (
          <button
            type="button"
            onClick={onToggleStop}
            aria-pressed={stopped}
            title={stopped ? "Fade the output back in" : "Fade the output to silence (Esc)"}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold ${stopped ? "bg-ink text-on-ink" : "bg-panel-raised text-text"}`}
          >
            {stopped ? (
              <svg viewBox="0 0 20 20" className="size-3" fill="currentColor" aria-hidden>
                <path d="M6 3.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7Z" />
              </svg>
            ) : (
              <span className="size-2.5 rounded-[3px] bg-accent shadow-[0_0_6px_var(--accent)]" aria-hidden />
            )}
            {stopped ? "Resume audio" : "Stop audio"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartAudio}
            data-tour="start-audio"
            disabled={audio === "starting"}
            className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-[13px] font-semibold text-on-ink disabled:cursor-default"
          >
            <svg viewBox="0 0 20 20" className="size-3" fill="currentColor" aria-hidden>
              <path d="M6 3.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7Z" />
            </svg>
            {audio === "starting" ? "Starting..." : audio === "error" ? "Retry audio" : "Start audio"}
          </button>
        )}
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

function LineIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 10h5l2-4 2 8 2-4h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
