"use client";

import { useEffect, useRef, useState } from "react";
import type { Rack } from "@/audio/rack";
import { PLUGINS, paramKey, specsForPlugin, type PluginId } from "@/audio/paramSchema";
import type { Gesture } from "@/mapping/types";
import { GESTURE_LABEL, formatParam } from "@/lib/format";
import { Collapsible } from "./Collapsible";

interface Props {
  values: Record<string, number>;
  bound: Map<string, Gesture>;
  onManualChange: (plugin: string, param: string, value: number) => void;
  rack: Rack | null;
}

/** All effects in one compact glass box, each effect a dropdown, with the output meter at the bottom. */
export function RackPanel({ values, bound, onManualChange, rack }: Props) {
  const liveCount = (pluginId: PluginId) => specsForPlugin(pluginId).filter((s) => bound.has(paramKey(s.plugin, s.param))).length;
  const totalLive = PLUGINS.reduce((n, p) => n + liveCount(p.id), 0);
  return (
    <section className="rounded-[var(--radius-panel)] glass" aria-label="Effects rack">
      <Collapsible title="Effects" badge={totalLive > 0 && <LiveBadge count={totalLive} />} defaultOpen>
        <div className="flex flex-col">
          {PLUGINS.map((plugin) => (
            <Collapsible
              key={plugin.id}
              level="item"
              title={plugin.label}
              badge={liveCount(plugin.id) > 0 && <LiveBadge count={liveCount(plugin.id)} />}
              defaultOpen
            >
              <PluginParams pluginId={plugin.id} values={values} bound={bound} onManualChange={onManualChange} />
            </Collapsible>
          ))}
        </div>
        <div className="mt-1 border-t border-border pt-2.5">
          <OutputMeter rack={rack} />
        </div>
      </Collapsible>
    </section>
  );
}

function LiveBadge({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium tracking-normal text-accent-text normal-case">
      {count} live
    </span>
  );
}

function PluginParams({
  pluginId,
  values,
  bound,
  onManualChange,
}: {
  pluginId: PluginId;
  values: Record<string, number>;
  bound: Map<string, Gesture>;
  onManualChange: (plugin: string, param: string, value: number) => void;
}) {
  const plugin = PLUGINS.find((p) => p.id === pluginId);
  return (
    <div className="flex flex-col gap-1.5">
      {specsForPlugin(pluginId).map((spec) => {
        const key = paramKey(spec.plugin, spec.param);
        const gesture = bound.get(key);
        const value = values[key];
        // Exponential params get a log-scaled slider so the useful range is not squashed.
        const logScale = spec.curve === "exp" && spec.min > 0;
        const toSlider = (v: number) =>
          logScale ? Math.log(v / spec.min) / Math.log(spec.max / spec.min) : (v - spec.min) / (spec.max - spec.min);
        const fromSlider = (t: number) => (logScale ? spec.min * Math.pow(spec.max / spec.min, t) : spec.min + t * (spec.max - spec.min));
        return (
          <label key={key} className="flex flex-col gap-0.5">
            <span className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-2">
                {spec.label}
                {gesture && (
                  <span
                    className="rounded-full bg-accent/15 px-1.5 py-px text-[10px] font-medium text-accent-text"
                    title={`Driven by ${GESTURE_LABEL[gesture]}`}
                  >
                    {GESTURE_LABEL[gesture]}
                  </span>
                )}
              </span>
              <span className={`font-mono text-xs ${gesture ? "text-accent-text" : "text-muted"}`}>{formatParam(spec, value)}</span>
            </span>
            {gesture ? (
              // Driven by a pinch: a glowing red bar instead of a greyed-out disabled slider.
              <span
                role="meter"
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={toSlider(value)}
                aria-label={`${plugin?.label ?? pluginId} ${spec.label}, driven by ${GESTURE_LABEL[gesture]}`}
                className="my-1.5 h-1.5 overflow-hidden rounded-full bg-accent/15"
              >
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-accent to-accent-soft shadow-[0_0_8px_var(--accent)] transition-[width] duration-75"
                  style={{ width: `${toSlider(value) * 100}%` }}
                />
              </span>
            ) : (
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={toSlider(value)}
                onChange={(e) => onManualChange(spec.plugin, spec.param, fromSlider(Number(e.target.value)))}
                className="cool"
                aria-label={`${plugin?.label ?? pluginId} ${spec.label}`}
              />
            )}
          </label>
        );
      })}
    </div>
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
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
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
