"use client";

import type { Preset } from "@/tutorials";

interface Props {
  presets: readonly Preset[];
  activeId: string | null;
  onLoad: (preset: Preset) => void;
}

export function PresetBar({ presets, activeId, onLoad }: Props) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-[var(--radius-panel)] border border-border bg-panel px-4 py-3"
      data-tour="preset-bar"
      role="group"
      aria-label="Presets"
    >
      <span className="mr-1 text-xs font-semibold tracking-wide text-muted uppercase">Presets</span>
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onLoad(p)}
          title={p.description}
          aria-pressed={activeId === p.id}
          className={`rounded-full border px-3 py-1 text-sm ${activeId === p.id ? "border-accent/60 bg-accent/15 text-accent" : "border-border text-muted hover:text-text"}`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
