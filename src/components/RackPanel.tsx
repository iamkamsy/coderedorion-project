"use client";

import { useEffect, useRef, useState } from "react";
import type { Rack } from "@/audio/rack";
import { PLUGINS, paramKey, specsForPlugin } from "@/audio/paramSchema";
import { rackPlugins, type EffectId } from "@/audio/rackSpec";
import type { Gesture } from "@/mapping/types";
import { GESTURE_LABEL, formatParam } from "@/lib/format";

interface Props {
  modules: readonly EffectId[];
  values: Record<string, number>;
  bound: Map<string, Gesture>;
  onManualChange: (plugin: string, param: string, value: number) => void;
  rack: Rack | null;
}

export function RackPanel({ modules, values, bound, onManualChange, rack }: Props) {
  const shown = new Set<string>(rackPlugins(modules));
  return (
    <aside className="flex flex-col gap-3 xl:min-h-0 xl:overflow-y-auto" aria-label="Effects rack">
      {PLUGINS.filter((p) => shown.has(p.id)).map((plugin) => (
        <div key={plugin.id} className="rounded-[var(--radius-panel)] border border-border bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{plugin.label}</h2>
            {plugin.id === "input" && <GateLight rack={rack} />}
          </div>
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

function GateLight({ rack }: { rack: Rack | null }) {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    if (!rack) return;
    let raf = 0;
    let last: boolean | null = null;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const next = rack.isGateOpen();
      if (next !== last) setOpen((last = next));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rack]);

  const live = rack !== null && open !== null;
  return (
    <span
      className={`flex items-center gap-1.5 text-[11px] ${live ? "text-muted" : "text-muted/60"}`}
      title="Low cut and gate apply to the vocal mic and instrument input, not the test loop"
    >
      <span className={`size-2 rounded-full ${live && open ? "bg-cool" : "bg-border"}`} />
      {live ? (open ? "Gate open" : "Gate closed") : "Live input only"}
    </span>
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
