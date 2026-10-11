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
      className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-panel)] glass px-3.5 py-2.5"
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
          className={`rounded-full px-3 py-1 text-[13px] transition-colors ${activeId === p.id ? "bg-ink font-semibold text-on-ink" : "border border-border bg-inset text-muted hover:text-text"}`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
