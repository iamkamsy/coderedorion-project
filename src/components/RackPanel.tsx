"use client";

import { useEffect, useRef, useState } from "react";
import type { Rack } from "@/audio/rack";
import { PLUGINS, paramKey, specsForPlugin, type ParamSpec } from "@/audio/paramSchema";
import { DIVISIONS, isEffectId, rackPlugins, type Division, type EffectId } from "@/audio/rackSpec";
import type { Gesture } from "@/mapping/types";
import { GESTURE_LABEL, formatParam } from "@/lib/format";

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

export function RackPanel(props: Props) {
  const { modules, values, bound, onManualChange, rack, showInput, bypassed, onBypassChange, division, onDivisionChange } = props;
  const shown = new Set<string>(rackPlugins(modules));
  if (!showInput) shown.delete("input");

  return (
    <aside className="flex flex-col gap-3 xl:min-h-0 xl:overflow-y-auto" aria-label="Effects rack">
      <ABButton held={props.dryHeld} onChange={props.onDryHeldChange} />
      {PLUGINS.filter((p) => shown.has(p.id)).map((plugin) => {
        const effect = isEffectId(plugin.id) ? plugin.id : null;
        const off = effect !== null && bypassed.has(effect);
        return (
          <div
            key={plugin.id}
            data-tour={`module-${plugin.id}`}
            className="rounded-[var(--radius-panel)] border border-border bg-panel p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className={`text-sm font-semibold tracking-wide uppercase ${off ? "text-muted/60" : "text-muted"}`}>{plugin.label}</h2>
              {plugin.id === "input" && <GateLight rack={rack} />}
              {effect && <BypassSwitch label={plugin.label} on={!off} onChange={(on) => onBypassChange(effect, !on)} />}
            </div>
            <div className={`flex flex-col gap-3 transition-opacity ${off ? "opacity-50" : ""}`}>
              {specsForPlugin(plugin.id).map((spec) => {
                const key = paramKey(spec.plugin, spec.param);
                const synced = key === "delay.delayTime" && division !== null;
                return (
                  <ParamSlider
                    key={key}
                    spec={spec}
                    pluginLabel={plugin.label}
                    value={values[key]}
                    gesture={bound.get(key)}
                    lockedLabel={synced && division ? `Synced ${DIVISIONS[division].label}` : null}
                    onChange={(v) => onManualChange(spec.plugin, spec.param, v)}
                  />
                );
              })}
              {plugin.id === "delay" && <DivisionPicker value={division} onChange={onDivisionChange} />}
            </div>
          </div>
        );
      })}
      <OutputMeter rack={rack} />
    </aside>
  );
}

function ParamSlider({
  spec,
  pluginLabel,
  value,
  gesture,
  lockedLabel,
  onChange,
}: {
  spec: ParamSpec;
  pluginLabel: string;
  value: number;
  gesture: Gesture | undefined;
  lockedLabel: string | null;
  onChange: (value: number) => void;
}) {
  // Exponential params get a log-scaled slider so the useful range is not squashed.
  const logScale = spec.curve === "exp" && spec.min > 0;
  const toSlider = (v: number) =>
    logScale ? Math.log(v / spec.min) / Math.log(spec.max / spec.min) : (v - spec.min) / (spec.max - spec.min);
  const fromSlider = (t: number) => (logScale ? spec.min * Math.pow(spec.max / spec.min, t) : spec.min + t * (spec.max - spec.min));
  const driven = !!gesture || !!lockedLabel;

  return (
    <label className="flex flex-col gap-1" data-tour={`param-${spec.plugin}.${spec.param}`}>
      <span className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2" title={spec.description}>
          {spec.label}
          {gesture && (
            <span
              className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent"
              title={`Driven by ${GESTURE_LABEL[gesture]}`}
            >
              {GESTURE_LABEL[gesture]}
            </span>
          )}
          {lockedLabel && <span className="rounded-full bg-cool/15 px-2 py-0.5 text-[11px] font-medium text-cool">{lockedLabel}</span>}
        </span>
        <span className={`font-mono text-xs ${gesture ? "text-accent" : "text-muted"}`}>{formatParam(spec, value)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={toSlider(value)}
        disabled={driven}
        onChange={(e) => onChange(fromSlider(Number(e.target.value)))}
        className={driven ? "" : "cool"}
        aria-label={`${pluginLabel} ${spec.label}`}
      />
    </label>
  );
}

function BypassSwitch({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label} ${on ? "on" : "bypassed"}`}
      onClick={() => onChange(!on)}
      data-tour={`bypass-${label.toLowerCase()}`}
      className="flex items-center gap-2 text-[11px] text-muted hover:text-text"
    >
      {on ? "On" : "Bypassed"}
      <span className={`relative h-4 w-7 rounded-full transition-colors ${on ? "bg-accent" : "bg-border"}`}>
        <span className={`absolute top-0.5 size-3 rounded-full bg-text transition-[left] ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function DivisionPicker({ value, onChange }: { value: Division | null; onChange: (d: Division | null) => void }) {
  const options: (Division | null)[] = [null, ...(Object.keys(DIVISIONS) as Division[])];
  return (
    <div data-tour="delay-division">
      <p className="mb-1 text-sm">Sync to beat</p>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Delay sync">
        {options.map((d) => (
          <button
            key={d ?? "free"}
            type="button"
            role="radio"
            aria-checked={value === d}
            onClick={() => onChange(d)}
            className={`rounded-md border px-2 py-0.5 font-mono text-xs ${value === d ? "border-cool/60 bg-cool/15 text-cool" : "border-border text-muted hover:text-text"}`}
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
      className={`rounded-[var(--radius-panel)] border px-4 py-3 text-left text-sm select-none ${held ? "border-cool/60 bg-cool/15 text-cool" : "border-border bg-panel hover:border-cool/40"}`}
    >
      <span className="font-medium">{held ? "Hearing the dry sound" : "Hold to hear it dry (A/B)"}</span>
      <span className="block text-xs text-muted">Compare with and without effects</span>
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
