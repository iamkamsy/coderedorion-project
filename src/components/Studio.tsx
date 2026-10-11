"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LIVE_SOURCES, SOURCE_LABEL, isLiveSource, type SourceKind } from "@/audio/inputs";
import type { Rack } from "@/audio/rack";
import { defaultParamValues, getParamSpec, PLUGINS } from "@/audio/paramSchema";
import { DEFAULT_MAPPING } from "@/mapping/defaults";
import { applyMapping, boundParams, computeChanges } from "@/mapping/engine";
import type { Gesture, GestureValues, Mapping } from "@/mapping/types";
import { validateMapping } from "@/mapping/validate";
import { EventBatcher, type BatcherStatus } from "@/lib/eventBatcher";
import { formatParam } from "@/lib/format";
import { ownerHeaders } from "@/lib/ownerId";
import { Assistant, type Proposal } from "./Assistant";
import { RackPanel } from "./RackPanel";
import { Spectrum } from "./Spectrum";
import { Stage, type CameraStatus, type Chip, type InputMode } from "./Stage";
import { TopBar, type AudioState, type SurfaceKind } from "./TopBar";
import { Collapsible } from "./Collapsible";
import { Landscape } from "./Landscape";

const DEFAULT_SUMMARY = "Right pinch opens reverb and delay feedback together. Left pinch sweeps the filter.";
const CONSENT_KEY = "gesture-rack.data-consent";

const consentListeners = new Set<() => void>();
const consentStore = {
  subscribe(cb: () => void) {
    consentListeners.add(cb);
    return () => consentListeners.delete(cb);
  },
  get(): boolean {
    try {
      return localStorage.getItem(CONSENT_KEY) === "true";
    } catch {
      return false;
    }
  },
  set(v: boolean) {
    try {
      localStorage.setItem(CONSENT_KEY, String(v));
    } catch {}
    consentListeners.forEach((cb) => cb());
  },
};

const SURFACE_KEY = "gesture-rack.surface";

const surfaceListeners = new Set<() => void>();
const surfaceStore = {
  subscribe(cb: () => void) {
    surfaceListeners.add(cb);
    return () => surfaceListeners.delete(cb);
  },
  get(): SurfaceKind {
    try {
      return localStorage.getItem(SURFACE_KEY) === "graphite" ? "graphite" : "tinted";
    } catch {
      return "tinted";
    }
  },
  set(v: SurfaceKind) {
    try {
      localStorage.setItem(SURFACE_KEY, v);
    } catch {}
    surfaceListeners.forEach((cb) => cb());
  },
};

/** Side boxes floating over the expanded camera, leaving room at the bottom for the pinch meters. */
const OVERLAY = "fixed top-24 z-40 flex max-h-[calc(100dvh-180px)] flex-col gap-4 overflow-y-auto";

export function Studio() {
  const rackRef = useRef<Rack | null>(null);
  const [rack, setRack] = useState<Rack | null>(null);
  const [audio, setAudio] = useState<AudioState>("off");
  const [source, setSource] = useState<SourceKind>("loop");
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const [camera, setCamera] = useState<CameraStatus>("off");
  const [inputMode, setInputMode] = useState<InputMode>("fake");
  const [fakeValues, setFakeValues] = useState<Record<Gesture, number>>({ pinch_left: 0.8, pinch_right: 0.3 });
  const [trackedValues, setTrackedValues] = useState<GestureValues>({ pinch_left: null, pinch_right: null });
  const [mapping, setMapping] = useState<Mapping>(DEFAULT_MAPPING);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [params, setParams] = useState<Record<string, number>>(defaultParamValues);
  const dataConsent = useSyncExternalStore(consentStore.subscribe, consentStore.get, () => false);
  const [dbStatus, setDbStatus] = useState<BatcherStatus>("idle");
  const surface = useSyncExternalStore(surfaceStore.subscribe, surfaceStore.get, () => "tinted" as const);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const batcherRef = useRef<EventBatcher | null>(null);
  useEffect(() => {
    const b = new EventBatcher(crypto.randomUUID(), setDbStatus);
    batcherRef.current = b;
    b.start();
    return () => b.stop();
  }, []);

  useEffect(() => {
    // Restore the producer's last approved mapping, if the database has one.
    fetch("/api/mappings", { headers: ownerHeaders(), signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const valid = data?.active ? validateMapping(data.active.mapping) : null;
        if (valid?.ok) {
          setMapping(valid.mapping);
          setSummary(data.active.name);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => () => rackRef.current?.dispose(), []);

  const gestureValues: GestureValues = inputMode === "fake" ? fakeValues : trackedValues;
  const bound = useMemo(() => boundParams(mapping), [mapping]);

  // Drive the rack from the active mapping whenever gestures or the mapping change.
  useEffect(() => {
    const r = rackRef.current;
    const changes = r ? applyMapping(mapping, gestureValues, (p, k, v) => r.setParam(p, k, v)) : computeChanges(mapping, gestureValues);
    if (changes.length === 0) return;
    setParams((prev) => {
      const next = { ...prev };
      for (const c of changes) next[`${c.plugin}.${c.param}`] = c.value;
      return next;
    });
    if (r) batcherRef.current?.push(changes);
  }, [mapping, gestureValues]);

  const startAudio = useCallback(async () => {
    setAudio("starting");
    try {
      const { Rack } = await import("@/audio/rack");
      const r = await Rack.start();
      for (const [key, value] of Object.entries(params)) {
        const [plugin, param] = key.split(".");
        r.setParam(plugin, param, value);
      }
      try {
        await r.setSource(source);
      } catch {
        setSource("loop");
        setSourceError(`Could not open the ${SOURCE_LABEL[source].toLowerCase()}. Playing the test loop instead.`);
        await r.setSource("loop");
      }
      rackRef.current = r;
      setRack(r);
      setAudio("on");
    } catch {
      setAudio("error");
    }
  }, [params, source]);

  const setAudioStopped = useCallback((next: boolean) => {
    const r = rackRef.current;
    if (!r) return;
    r.setStopped(next);
    setStopped(next);
  }, []);

  // Esc is a panic stop. It only stops; resuming is a deliberate click.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.repeat) setAudioStopped(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setAudioStopped]);

  const changeSource = useCallback(async (s: SourceKind) => {
    setSource(s);
    setSourceError(null);
    const r = rackRef.current;
    if (isLiveSource(s)) {
      const lowCut = r ? r.setParam("input", "lowCut", LIVE_SOURCES[s].lowCutHz) : LIVE_SOURCES[s].lowCutHz;
      setParams((prev) => ({ ...prev, "input.lowCut": lowCut }));
    }
    if (!r) return;
    try {
      await r.setSource(s);
    } catch {
      setSource("loop");
      setSourceError(`Could not open the ${SOURCE_LABEL[s].toLowerCase()}. Check microphone permission and the selected input device.`);
      await r.setSource("loop");
    }
  }, []);

  const manualChange = useCallback((plugin: string, param: string, value: number) => {
    const safe = rackRef.current ? rackRef.current.setParam(plugin, param, value) : value;
    setParams((prev) => ({ ...prev, [`${plugin}.${param}`]: safe }));
    if (rackRef.current) batcherRef.current?.push([{ plugin, param, value: safe, gesture: null }]);
  }, []);

  const approve = useCallback((p: Proposal) => {
    setMapping(p.mapping);
    setSummary(p.summary);
    fetch("/api/mappings", {
      method: "POST",
      headers: ownerHeaders(),
      body: JSON.stringify({ name: p.summary.slice(0, 120) || p.intent, intent: p.intent, mapping: p.mapping }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }, []);

  const changeConsent = useCallback((v: boolean) => {
    consentStore.set(v);
    fetch("/api/profile", {
      method: "PUT",
      headers: ownerHeaders(),
      body: JSON.stringify({ dataConsent: v }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }, []);

  const chips = useMemo(() => {
    const out = { pinch_left: [] as Chip[], pinch_right: [] as Chip[] };
    for (const m of mapping.mappings) {
      for (const t of m.targets) {
        const spec = getParamSpec(t.plugin, t.param);
        if (!spec) continue;
        const plugin = PLUGINS.find((p) => p.id === t.plugin)?.label ?? t.plugin;
        out[m.gesture].push({ label: `${plugin} ${spec.label}`, value: formatParam(spec, params[`${t.plugin}.${t.param}`]) });
      }
    }
    return out;
  }, [mapping, params]);

  const resetMapping = () => (setMapping(DEFAULT_MAPPING), setSummary(DEFAULT_SUMMARY));

  // Three columns from xl up keep the camera centered on the page; below that the camera sits on top.
  const body = (
    <main className={`surface-${surface} flex min-h-0 flex-1 flex-col overflow-y-auto p-4 xl:overflow-hidden`}>
      {/* Expanded camera: a clean landscape fills the border around it, and the side boxes float over it. */}
      {expanded && <Landscape id="expand" className="fixed inset-0 z-[25]" />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        <div
          className={
            expanded
              ? `${OVERLAY} left-8 w-[300px]`
              : "order-2 flex flex-col gap-4 xl:order-none xl:col-start-1 xl:row-start-1 xl:min-h-0 xl:overflow-y-auto"
          }
        >
          <section className="rounded-[var(--radius-panel)] glass" aria-label="AI assistant">
            <Collapsible title="AI assistant" defaultOpen>
              <Assistant activeSummary={summary} onApprove={approve} onResetDefault={resetMapping} />
            </Collapsible>
          </section>
        </div>
        <div className="order-1 flex flex-col gap-4 lg:col-span-2 xl:order-none xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:min-h-0 xl:overflow-y-auto">
          <Stage
            inputMode={inputMode}
            onInputModeChange={setInputMode}
            onCameraStatus={setCamera}
            onTracked={setTrackedValues}
            fakeValues={fakeValues}
            onFakeChange={(g, v) => setFakeValues((prev) => ({ ...prev, [g]: v }))}
            values={gestureValues}
            chips={chips}
            expanded={expanded}
            onToggleExpand={() => setExpanded((v) => !v)}
          />
          {/* Over the expanded camera, the spectrum floats as a slim bar beside the shrink button, clear of the pinch meters. */}
          <div className={expanded ? "fixed right-[76px] bottom-7 z-40 w-[min(380px,calc(100vw-620px))]" : ""}>
            <Spectrum rack={rack} floating={expanded} />
          </div>
        </div>
        <div
          className={
            expanded
              ? `${OVERLAY} right-8 w-[280px]`
              : "order-3 flex flex-col gap-4 xl:order-none xl:col-start-3 xl:row-start-1 xl:min-h-0 xl:overflow-y-auto"
          }
        >
          <RackPanel values={params} bound={bound} onManualChange={manualChange} rack={rack} />
        </div>
      </div>
    </main>
  );

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        audio={audio}
        onStartAudio={startAudio}
        stopped={stopped}
        onToggleStop={() => setAudioStopped(!stopped)}
        source={source}
        onSourceChange={changeSource}
        camera={camera}
        dataConsent={dataConsent}
        onConsentChange={changeConsent}
        dbStatus={dbStatus}
        surface={surface}
        onSurfaceChange={surfaceStore.set}
      />

      {sourceError && (
        <div className="border-b border-border bg-danger/10 px-5 py-2 text-sm text-danger" role="alert">
          {sourceError}
        </div>
      )}
      {audio === "on" && stopped && (
        <div className="border-b border-border bg-danger/10 px-5 py-2 text-sm" role="status">
          Audio stopped. Gestures and the rack keep running silently. Click Resume audio to bring it back.
        </div>
      )}
      {audio !== "on" && (
        <p className="glass mx-auto mt-3 flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-sm">
          <span className={`size-1.5 rounded-full ${audio === "error" ? "bg-danger" : "bg-accent"}`} aria-hidden />
          {audio === "error" ? "Audio could not start. Click Retry audio." : "Click Start audio to hear the rack. Headphones recommended."}
        </p>
      )}

      {body}
    </div>
  );
}
