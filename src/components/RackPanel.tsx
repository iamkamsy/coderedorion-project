"use client";

import { useEffect, useRef, useState } from "react";
import type { Rack } from "@/audio/rack";
import { PLUGINS, paramKey, specsForPlugin } from "@/audio/paramSchema";
import type { Gesture } from "@/mapping/types";
import { GESTURE_LABEL, formatParam } from "@/lib/format";

interface Props {
  values: Record<string, number>;
  bound: Map<string, Gesture>;
  onManualChange: (plugin: string, param: string, value: number) => void;
  rack: Rack | null;
}

export function RackPanel({ values, bound, onManualChange, rack }: Props) {
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto" aria-label="Effects rack">
      {PLUGINS.map((plugin) => (
        <div key={plugin.id} className="rounded-[var(--radius-panel)] border border-border bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{plugin.label}</h2>
          <div className="flex flex-col gap-3">
            {specsForPlugin(plugin.id).map((spec) => {
              const key = paramKey(spec.plugin, spec.param);
              const gesture = bound.get(key);
              const value = values[key];
              // Exponential params get a log-scaled slider so the useful range is not squashed.
              const logScale = spec.curve === "exp" && spec.min > 0;
              const toSlider = (v: number) =>
                logScale ? Math.log(v / spec.min) / Math.log(spec.max / spec.min) : (v - spec.min) / (spec.max - spec.min);
              const fromSlider = (t: number) =>
                logScale ? spec.min * Math.pow(spec.max / spec.min, t) : spec.min + t * (spec.max - spec.min);
              return (
                <label key={key} className="flex flex-col gap-1">
                  <span className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {spec.label}
                      {gesture && (
                        <span
                          className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent"
                          title={`Driven by ${GESTURE_LABEL[gesture]}`}
                        >
                          {GESTURE_LABEL[gesture]}
                        </span>
                      )}
                    </span>
                    <span className={`font-mono text-xs ${gesture ? "text-accent" : "text-muted"}`}>{formatParam(spec, value)}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.001}
                    value={toSlider(value)}
                    disabled={!!gesture}
                    onChange={(e) => onManualChange(spec.plugin, spec.param, fromSlider(Number(e.target.value)))}
                    className={gesture ? "" : "cool"}
                    aria-label={`${plugin.label} ${spec.label}`}
                  />
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <OutputMeter rack={rack} />
    </aside>
  );
}

function OutputMeter({ rack }: { rack: Rack | null }) {
  const barRef = useRef<HTMLDivElement>(null);
  const [limiting, setLimiting] = useState(false);

  useEffect(() => {
    if (!rack) return;
    let raf = 0;
    let lastLimit = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const db = rack.getOutputLevel();
      const pct = Math.min(100, Math.max(0, ((db + 60) / 60) * 100));
      if (barRef.current) barRef.current.style.width = `${pct}%`;
      const l = rack.isLimiting();
      if (l !== lastLimit) setLimiting((lastLimit = l));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rack]);

  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-panel p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold tracking-wide text-muted uppercase">Output</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${limiting ? "bg-warn/20 text-warn" : "bg-border text-muted"}`}
          title="The limiter is always on and cannot be disabled"
        >
          Limiter {limiting ? "active" : "on"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-border">
        <div ref={barRef} className="h-full bg-cool" style={{ width: 0 }} />
      </div>
    </div>
  );
}
