"use client";

import { useEffect, useRef, useState } from "react";
import type { Rack } from "@/audio/rack";
import { PLUGINS, paramKey, specsForPlugin, type PluginId } from "@/audio/paramSchema";
import { DIVISIONS, isEffectId, rackPlugins, type Division, type EffectId } from "@/audio/rackSpec";
import type { Gesture } from "@/mapping/types";
import { GESTURE_LABEL, formatParam } from "@/lib/format";
import { Collapsible } from "./Collapsible";

interface Props {
  modules: readonly EffectId[];
  values: Record<string, number>;
  bound: Map<string, Gesture>;
  onManualChange: (plugin: string, param: string, value: number) => void;
  rack: Rack | null;
  /** Show the input stage (low cut, gate). Only useful with a live source. */
  showInput: boolean;
  bypassed: ReadonlySet<EffectId>;
  onBypassChange: (id: EffectId, bypassed: boolean) => void;
  division: Division | null;
  onDivisionChange: (division: Division | null) => void;
  dryHeld: boolean;
  onDryHeldChange: (held: boolean) => void;
}

/** All effects in one compact glass box, each effect a dropdown, with the output meter at the bottom. */
export function RackPanel(props: Props) {
  const { modules, values, bound, onManualChange, rack, showInput, bypassed, onBypassChange, division, onDivisionChange } = props;
  const loaded = new Set<string>(rackPlugins(modules));
  if (!showInput) loaded.delete("input");
  const plugins = PLUGINS.filter((p) => loaded.has(p.id));
  const liveCount = (pluginId: PluginId) => specsForPlugin(pluginId).filter((s) => bound.has(paramKey(s.plugin, s.param))).length;
  const totalLive = plugins.reduce((n, p) => n + liveCount(p.id), 0);
  return (
    <section className="rounded-[var(--radius-panel)] glass" aria-label="Effects rack">
      <Collapsible title="Effects" badge={totalLive > 0 && <LiveBadge count={totalLive} />} defaultOpen>
        <ABButton held={props.dryHeld} onChange={props.onDryHeldChange} />
        <div className="flex flex-col">
          {plugins.map((plugin) => {
            const effect = isEffectId(plugin.id) ? plugin.id : null;
            const off = effect !== null && bypassed.has(effect);
            return (
              <div key={plugin.id} data-tour={`module-${plugin.id}`}>
                <Collapsible
                  level="item"
                  title={plugin.label}
                  badge={liveCount(plugin.id) > 0 && <LiveBadge count={liveCount(plugin.id)} />}
                  actions={
                    plugin.id === "input" ? (
                      <GateLight rack={rack} />
                    ) : (
                      effect && <BypassSwitch label={plugin.label} on={!off} onChange={(on) => onBypassChange(effect, !on)} />
                    )
                  }
                  defaultOpen
                >
                  <div className={`transition-opacity ${off ? "opacity-45" : ""}`}>
                    <PluginParams pluginId={plugin.id} values={values} bound={bound} division={division} onManualChange={onManualChange} />
                    {plugin.id === "delay" && <DivisionPicker value={division} onChange={onDivisionChange} />}
                  </div>
                </Collapsible>
              </div>
            );
          })}
        </div>
        <div className="mt-1 border-t border-border pt-2.5" data-tour="output-meter">
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
  division,
  onManualChange,
}: {
  pluginId: PluginId;
  values: Record<string, number>;
  bound: Map<string, Gesture>;
  division: Division | null;
  onManualChange: (plugin: string, param: string, value: number) => void;
}) {
  const plugin = PLUGINS.find((p) => p.id === pluginId);
  return (
    <div className="flex flex-col gap-1.5">
      {specsForPlugin(pluginId).map((spec) => {
        const key = paramKey(spec.plugin, spec.param);
        const gesture = bound.get(key);
        const synced = key === "delay.delayTime" && division !== null ? DIVISIONS[division].label : null;
        const value = values[key];
        // Exponential params get a log-scaled slider so the useful range is not squashed.
        const logScale = spec.curve === "exp" && spec.min > 0;
        const toSlider = (v: number) =>
          logScale ? Math.log(v / spec.min) / Math.log(spec.max / spec.min) : (v - spec.min) / (spec.max - spec.min);
        const fromSlider = (t: number) => (logScale ? spec.min * Math.pow(spec.max / spec.min, t) : spec.min + t * (spec.max - spec.min));
        const name = `${plugin?.label ?? pluginId} ${spec.label}`;
        return (
          <label key={key} className="flex flex-col gap-0.5" data-tour={`param-${key}`}>
            <span className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-2" title={spec.description}>
                {spec.label}
                {gesture && (
                  <span
                    className="rounded-full bg-accent/15 px-1.5 py-px text-[10px] font-medium text-accent-text"
                    title={`Driven by ${GESTURE_LABEL[gesture]}`}
                  >
                    {GESTURE_LABEL[gesture]}
                  </span>
                )}
                {synced && <span className="rounded-full bg-panel-raised px-1.5 py-px text-[10px] font-medium">Synced {synced}</span>}
              </span>
              <span className={`font-mono text-xs ${gesture ? "text-accent-text" : "text-muted"}`}>{formatParam(spec, value)}</span>
            </span>
            {gesture || synced ? (
              // Driven by a pinch (glowing red) or locked to the beat (neutral): a bar, not a greyed-out slider.
              <span
                role="meter"
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={toSlider(value)}
                aria-label={gesture ? `${name}, driven by ${GESTURE_LABEL[gesture]}` : `${name}, synced to ${synced}`}
                className={`my-1.5 h-1.5 overflow-hidden rounded-full ${gesture ? "bg-accent/15" : "bg-panel-raised"}`}
              >
                <span
                  className={`block h-full rounded-full ${gesture ? "bg-gradient-to-r from-accent to-accent-soft shadow-[0_0_8px_var(--accent)]" : "bg-cool"}`}
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
                aria-label={name}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

function BypassSwitch({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label} ${on ? "on" : "bypassed"}`}
      title={on ? `Bypass ${label}` : `Turn ${label} on`}
      onClick={() => onChange(!on)}
      data-tour={`bypass-${label.toLowerCase()}`}
      className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted hover:text-text"
    >
      {on ? "On" : "Off"}
      <span
        className={`relative h-4 w-7 rounded-full border transition-colors ${on ? "border-accent bg-accent" : "border-border bg-black/10"}`}
      >
        <span className={`absolute top-px size-3 rounded-full bg-white shadow transition-[left] ${on ? "left-3" : "left-px"}`} />
      </span>
    </button>
  );
}

function DivisionPicker({ value, onChange }: { value: Division | null; onChange: (d: Division | null) => void }) {
  const options: (Division | null)[] = [null, ...(Object.keys(DIVISIONS) as Division[])];
  return (
    <div className="mt-2" data-tour="delay-division">
      <p className="mb-1 text-[11px]">Sync to beat</p>
      <div className="flex flex-wrap gap-0.5 rounded-full bg-black/[0.06] p-0.5" role="radiogroup" aria-label="Delay sync">
        {options.map((d) => (
          <button
            key={d ?? "free"}
            type="button"
            role="radio"
            aria-checked={value === d}
            onClick={() => onChange(d)}
            className={`rounded-full px-2 py-0.5 font-mono text-[11px] transition-colors ${value === d ? "bg-white font-medium text-[#111] shadow-[0_1px_3px_rgb(0_0_0/0.14)]" : "text-muted hover:text-text"}`}
          >
            {d ? DIVISIONS[d].label : "Free"}
          </button>
        ))}
      </div>
    </div>
  );
}

function ABButton({ held, onChange }: { held: boolean; onChange: (held: boolean) => void }) {
  return (
    <button
      type="button"
      data-tour="ab"
      aria-pressed={held}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(true);
      }}
      onPointerUp={() => onChange(false)}
      onPointerCancel={() => onChange(false)}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          onChange(true);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") onChange(false);
      }}
      onBlur={() => onChange(false)}
      className={`mb-2 w-full rounded-xl border px-3 py-2 text-left select-none transition-colors ${held ? "border-accent bg-accent/15" : "border-border bg-inset hover:border-accent/50"}`}
    >
      <span className="block text-[13px] font-medium">{held ? "Hearing the dry sound" : "Hold to hear it dry (A/B)"}</span>
      <span className="block text-[11px] text-muted">Compare with and without effects</span>
    </button>
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
