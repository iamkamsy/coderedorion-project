"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PARAM_SPECS, PLUGINS, getParamSpec } from "@/audio/paramSchema";
import { formatParam } from "@/lib/format";
import { ownerHeaders } from "@/lib/ownerId";

interface Row {
  bucket: string;
  plugin: string;
  param: string;
  avg: number;
  min: number;
  max: number;
  n: number;
}

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; rows: Row[] };

const REFRESH_MS = 10000;

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Dashboard() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/activity", { headers: ownerHeaders(), signal: AbortSignal.timeout(8000) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not load activity");
        if (!cancelled) setState({ kind: "ready", rows: data.rows });
      } catch (err) {
        if (!cancelled) setState({ kind: "error", message: err instanceof Error ? err.message : "Could not load activity" });
      }
    };
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const rows = useMemo(() => (state.kind === "ready" ? state.rows : []), [state]);
  const byParam = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const key = `${r.plugin}.${r.param}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return groups;
  }, [rows]);
  const totalEvents = rows.reduce((s, r) => s + r.n, 0);
  const activeMinutes = new Set(rows.map((r) => r.bucket)).size;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Session activity</h1>
          <p className="text-sm text-muted">Last hour, per minute, from the Tiger Data continuous aggregate.</p>
        </div>
        <Link href="/" className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-text">
          Back to rack
        </Link>
      </header>

      {state.kind === "loading" && <p className="text-muted">Loading activity...</p>}
      {state.kind === "error" && (
        <div className="rounded-[var(--radius-panel)] border border-danger/40 bg-danger/10 p-4 text-sm">
          {state.message}. The rack still works; events will appear here once the database is reachable.
        </div>
      )}

      {state.kind === "ready" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Parameter events" value={totalEvents.toLocaleString()} />
            <Stat label="Active minutes" value={String(activeMinutes)} />
            <Stat label="Parameters moved" value={`${byParam.size} of ${PARAM_SPECS.length}`} />
          </div>

          {rows.length === 0 ? (
            <p className="rounded-[var(--radius-panel)] border border-border bg-panel p-6 text-center text-muted">
              No activity yet. Start audio on the rack and pinch to generate events.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[...byParam.entries()].map(([key, series]) => (
                  <ParamChart key={key} paramKey={key} rows={series} />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowTable((v) => !v)}
                className="self-start text-sm text-muted underline hover:text-text"
              >
                {showTable ? "Hide table" : "Show as table"}
              </button>
              {showTable && <ActivityTable rows={rows} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl">{value}</p>
    </div>
  );
}

function paramTitle(plugin: string, param: string) {
  const spec = getParamSpec(plugin, param);
  const pluginLabel = PLUGINS.find((p) => p.id === plugin)?.label ?? plugin;
  return `${pluginLabel} ${spec?.label ?? param}`;
}

function ParamChart({ paramKey, rows }: { paramKey: string; rows: Row[] }) {
  const [plugin, param] = paramKey.split(".");
  const spec = getParamSpec(plugin, param);
  if (!spec) return null;
  const fmt = (v: number) => formatParam(spec, v);

  return (
    <figure className="rounded-[var(--radius-panel)] border border-border bg-panel p-4">
      <figcaption className="mb-2 text-sm font-medium">
        {paramTitle(plugin, param)} <span className="text-muted">· average per minute</span>
      </figcaption>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="bucket"
              tickFormatter={timeLabel}
              stroke="var(--muted)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={24}
            />
            <YAxis
              domain={[spec.min, spec.max]}
              tickFormatter={fmt}
              stroke="var(--muted)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
              scale={spec.curve === "exp" ? "log" : "linear"}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              contentStyle={{ background: "var(--panel-raised)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "var(--muted)" }}
              itemStyle={{ color: "var(--text)" }}
              labelFormatter={(l) => timeLabel(String(l))}
              formatter={(v, _name, item) => {
                const r = item.payload as Row;
                return [`${fmt(Number(v))} (range ${fmt(r.min)} to ${fmt(r.max)}, ${r.n} events)`, "Average"];
              }}
            />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="var(--cool)"
              strokeWidth={2}
              dot={rows.length < 3 ? { r: 4, fill: "var(--cool)" } : false}
              activeDot={{ r: 4, stroke: "var(--panel)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function ActivityTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border bg-panel">
      <table className="w-full text-left text-sm">
        <thead className="text-muted">
          <tr>
            {["Minute", "Parameter", "Average", "Min", "Max", "Events"].map((h) => (
              <th key={h} className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {rows.map((r) => {
            const spec = getParamSpec(r.plugin, r.param);
            const f = (v: number) => (spec ? formatParam(spec, v) : v.toFixed(2));
            return (
              <tr key={`${r.bucket}-${r.plugin}-${r.param}`} className="border-t border-border">
                <td className="px-4 py-1.5">{timeLabel(r.bucket)}</td>
                <td className="px-4 py-1.5 font-sans">{paramTitle(r.plugin, r.param)}</td>
                <td className="px-4 py-1.5">{f(r.avg)}</td>
                <td className="px-4 py-1.5">{f(r.min)}</td>
                <td className="px-4 py-1.5">{f(r.max)}</td>
                <td className="px-4 py-1.5">{r.n}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
