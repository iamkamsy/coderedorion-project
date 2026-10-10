"use client";

import Link from "next/link";
import { SOURCE_LABEL, type SourceKind } from "@/audio/inputs";
import type { BatcherStatus } from "@/lib/eventBatcher";
import type { CameraStatus } from "./Stage";

export type AudioState = "off" | "starting" | "on" | "error";

interface Props {
  audio: AudioState;
  onStartAudio: () => void;
  stopped: boolean;
  onToggleStop: () => void;
  source: SourceKind;
  onSourceChange: (s: SourceKind) => void;
  camera: CameraStatus;
  dataConsent: boolean;
  onConsentChange: (v: boolean) => void;
  dbStatus: BatcherStatus;
  /** Set inside a tutorial playground. */
  lesson?: { number: number; title: string };
}

const CAMERA_LABEL: Record<CameraStatus, { text: string; tone: string }> = {
  off: { text: "Camera off", tone: "bg-border" },
  requesting: { text: "Requesting camera", tone: "bg-warn" },
  "loading-model": { text: "Loading tracking", tone: "bg-warn" },
  ready: { text: "Tracking", tone: "bg-cool" },
  denied: { text: "Camera blocked", tone: "bg-danger" },
  error: { text: "Tracking failed", tone: "bg-danger" },
};

export function TopBar({
  audio,
  onStartAudio,
  stopped,
  onToggleStop,
  source,
  onSourceChange,
  camera,
  dataConsent,
  onConsentChange,
  dbStatus,
  lesson,
}: Props) {
  const cam = CAMERA_LABEL[camera];
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-3">
      {lesson ? (
        <nav className="flex items-baseline gap-2" aria-label="Breadcrumb">
          <Link href="/learn" className="text-sm text-muted hover:text-text">
            ← Lessons
          </Link>
          <span className="text-lg font-semibold tracking-tight">
            <span className="text-muted">{lesson.number}.</span> {lesson.title}
          </span>
        </nav>
      ) : (
        <div className="flex items-baseline gap-2">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Gesture Rack
          </Link>
          <span className="hidden text-xs text-muted sm:inline">shape your sound with your hands</span>
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
        <span className="flex items-center gap-2 text-muted">
          <span className={`size-2 rounded-full ${cam.tone}`} />
          {cam.text}
        </span>
        <span className="flex items-center gap-2 text-muted" title="Parameter events are streamed to Tiger Data about once per second">
          <span className={`size-2 rounded-full ${dbStatus === "ok" ? "bg-cool" : dbStatus === "offline" ? "bg-warn" : "bg-border"}`} />
          {dbStatus === "offline" ? "Data offline" : "Data stream"}
        </span>

        <select
          value={source}
          onChange={(e) => onSourceChange(e.target.value as SourceKind)}
          className="rounded-lg border border-border bg-panel px-2 py-1.5 text-sm"
          aria-label="Audio source"
        >
          {(Object.keys(SOURCE_LABEL) as SourceKind[]).map((k) => (
            <option key={k} value={k}>
              {SOURCE_LABEL[k]}
            </option>
          ))}
        </select>

        <label
          className="flex cursor-pointer items-center gap-2 text-muted"
          title="Off by default. When on, your intent text and effect descriptions may be stored to improve mappings."
        >
          <input
            type="checkbox"
            checked={dataConsent}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Share data
        </label>

        {lesson ? (
          <Link href="/" className="text-muted hover:text-text">
            Free play
          </Link>
        ) : (
          <Link href="/learn" className="font-medium text-accent hover:text-text">
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
            className={`rounded-lg px-4 py-1.5 font-medium ${stopped ? "bg-accent text-bg" : "border border-danger/50 text-danger hover:bg-danger/10"}`}
          >
            {stopped ? "Resume audio" : "Stop audio"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartAudio}
            data-tour="start-audio"
            disabled={audio === "starting"}
            className="rounded-lg bg-accent px-4 py-1.5 font-medium text-bg disabled:cursor-default"
          >
            {audio === "starting" ? "Starting..." : audio === "error" ? "Retry audio" : "Start audio"}
          </button>
        )}
      </div>
    </header>
  );
}
