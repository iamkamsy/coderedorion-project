"use client";

import Link from "next/link";
import { SOURCE_LABEL, type SourceKind } from "@/audio/inputs";
import type { BatcherStatus } from "@/lib/eventBatcher";
import type { CameraStatus } from "./Stage";

export type AudioState = "off" | "starting" | "on" | "error";

interface Props {
  audio: AudioState;
  onStartAudio: () => void;
  source: SourceKind;
  onSourceChange: (s: SourceKind) => void;
  camera: CameraStatus;
  dataConsent: boolean;
  onConsentChange: (v: boolean) => void;
  dbStatus: BatcherStatus;
}

const CAMERA_LABEL: Record<CameraStatus, { text: string; tone: string }> = {
  off: { text: "Camera off", tone: "bg-border" },
  requesting: { text: "Requesting camera", tone: "bg-warn" },
  "loading-model": { text: "Loading tracking", tone: "bg-warn" },
  ready: { text: "Tracking", tone: "bg-cool" },
  denied: { text: "Camera blocked", tone: "bg-danger" },
  error: { text: "Tracking failed", tone: "bg-danger" },
};

export function TopBar({ audio, onStartAudio, source, onSourceChange, camera, dataConsent, onConsentChange, dbStatus }: Props) {
  const cam = CAMERA_LABEL[camera];
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold tracking-tight">Gesture Rack</span>
        <span className="hidden text-xs text-muted sm:inline">shape your sound with your hands</span>
      </div>

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

        <Link href="/dashboard" className="text-muted hover:text-text">
          Dashboard
        </Link>

        <button
          type="button"
          onClick={onStartAudio}
          disabled={audio === "starting" || audio === "on"}
          className={`rounded-lg px-4 py-1.5 font-medium ${audio === "on" ? "bg-cool/15 text-cool" : "bg-accent text-bg"} disabled:cursor-default`}
        >
          {audio === "on" ? "Audio on" : audio === "starting" ? "Starting..." : audio === "error" ? "Retry audio" : "Start audio"}
        </button>
      </div>
    </header>
  );
}
