"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LIVE_SOURCES, SOURCE_LABEL, isLiveSource, type SourceKind } from "@/audio/inputs";
import type { Rack } from "@/audio/rack";
import { getParamSpec, PLUGINS } from "@/audio/paramSchema";
import { STUDIO_BYPASSED, STUDIO_MODULES, defaultValuesFor, isEffectId, type Division, type EffectId } from "@/audio/rackSpec";
import { DEFAULT_MAPPING } from "@/mapping/defaults";
import { applyMapping, boundParams, computeChanges, toggleTarget } from "@/mapping/engine";
import type { Gesture, GestureValues, Mapping } from "@/mapping/types";
import { validateMapping } from "@/mapping/validate";
import { EventBatcher, type BatcherStatus } from "@/lib/eventBatcher";
import { formatParam, summarizeMapping } from "@/lib/format";
import { syncDefaultConsent } from "@/lib/consent";
import { ownerHeaders } from "@/lib/ownerId";
import { DREAMY_FALLBACK, pinchedClosed } from "@/onboarding/steps";
import { useOnboarding } from "@/onboarding/useOnboarding";
import { getTutorial, type Preset } from "@/tutorials";
import type { CoachSignals } from "@/tutorials/checks";
import { Assistant, type Proposal } from "./Assistant";
import { OnboardingCoach } from "./OnboardingCoach";
import { PresetBar } from "./PresetBar";
import { TutorialCoach } from "./TutorialCoach";
import { RackPanel } from "./RackPanel";
import { Spectrum } from "./Spectrum";
import { Stage, type CameraStatus, type Chip, type InputMode, type StageHandle } from "./Stage";
import { TopBar, type AudioState, type SurfaceKind } from "./TopBar";
import { Collapsible } from "./Collapsible";
import { Landscape } from "./Landscape";

const DEFAULT_SUMMARY = "Right pinch opens reverb and delay feedback together. Left pinch sweeps the filter.";
const SURFACE_KEY = "gesture-rack.surface";
/** The box-style switch is hidden for now and every box is graphite. Set to true to bring the switch back. */
const SURFACE_SWITCH = false;

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

interface StudioProps {
  /** Effects this rack loads. Mappings are limited to them. */
  modules?: readonly EffectId[];
  /** Effects that start bypassed. */
  initialBypassed?: readonly EffectId[];
  /** Run as a lesson playground: the lesson's effects, presets and coach. */
  tutorialSlug?: string;
}

/**
 * One self-contained session: its own rack, tracker, event batcher and session id.
 * Unmounting releases all of it, so mount a new instance (for example with a `key`)
 * to start a fresh, isolated session.
 */
export function Studio({ modules: studioModules = STUDIO_MODULES, initialBypassed = STUDIO_BYPASSED, tutorialSlug }: StudioProps) {
  // Fixed for the lifetime of this session; a different lesson is a different mount.
  const [tutorial] = useState(() => (tutorialSlug ? getTutorial(tutorialSlug) : undefined) ?? null);
  const modules = tutorial?.modules ?? studioModules;
  const startMapping = tutorial?.mapping ?? DEFAULT_MAPPING;
  const startSummary = tutorial?.summary ?? DEFAULT_SUMMARY;
  const aliveRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const rackRef = useRef<Rack | null>(null);
  const stageRef = useRef<StageHandle>(null);
  /** True once the user has approved, loaded or reset a mapping in this session. */
  const mappingChosenRef = useRef(false);
  /** Guards startAudio against re-entry from a stale call that raced ahead of the "audio" state update. */
  const startingRef = useRef(false);
  const [rack, setRack] = useState<Rack | null>(null);
  const [audio, setAudio] = useState<AudioState>("off");
  const [source, setSource] = useState<SourceKind>("loop");
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const [bypassed, setBypassed] = useState<ReadonlySet<EffectId>>(
    () => new Set(tutorial ? [] : initialBypassed.filter((id) => modules.includes(id))),
  );
  const [division, setDivision] = useState<Division | null>(null);
  const [dryHeld, setDryHeld] = useState(false);
  const [camera, setCamera] = useState<CameraStatus>("off");
  const [inputMode, setInputMode] = useState<InputMode>("fake");
  const [fakeValues, setFakeValues] = useState<Record<Gesture, number>>({ pinch_left: 0.8, pinch_right: 0.3 });
  const [trackedValues, setTrackedValues] = useState<GestureValues>({ pinch_left: null, pinch_right: null });
  const [mapping, setMapping] = useState<Mapping>(startMapping);
  const [summary, setSummary] = useState(startSummary);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [presetsLoaded, setPresetsLoaded] = useState<ReadonlySet<string>>(new Set());
  const [bypassToggled, setBypassToggled] = useState<ReadonlySet<string>>(new Set());
  const [abUsed, setAbUsed] = useState(false);
  const [asked, setAsked] = useState(false);
  const [params, setParams] = useState<Record<string, number>>(() => defaultValuesFor(modules));
  const [dbStatus, setDbStatus] = useState<BatcherStatus>("idle");
  const storedSurface = useSyncExternalStore(surfaceStore.subscribe, surfaceStore.get, () => "tinted" as const);
  const surface = SURFACE_SWITCH ? storedSurface : "graphite";
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
    // Lessons always start from the lesson's mapping.
    if (tutorial) return;
    // Restore the producer's last approved mapping, if the database has one.
    fetch("/api/mappings", { headers: ownerHeaders(), signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        // A slow answer must not undo a mapping the user has chosen (or reset) in the meantime.
        if (mappingChosenRef.current) return;
        const valid = data?.active ? validateMapping(data.active.mapping, { plugins: modules }) : null;
        if (valid?.ok) {
          setMapping(valid.mapping);
          setSummary(data.active.name);
        }
      })
      .catch(() => {});
  }, [modules, tutorial]);

  useEffect(() => syncDefaultConsent(), []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      rackRef.current?.dispose();
      rackRef.current = null;
    };
  }, []);

  const gestureValues: GestureValues = inputMode === "fake" ? fakeValues : trackedValues;
  const bound = useMemo(() => boundParams(mapping), [mapping]);
  const tour = useOnboarding({ enabled: !tutorial, values: gestureValues, audioOn: audio === "on", stopped });
  const touring = tour.phase !== "off";
  // The intro uses the expanded view: the camera fills the screen and panels float in over it.
  const wide = expanded || touring;
  // During the intro, the stop and lock gestures only work on the steps that teach them.
  const tourStep = tour.step?.id;

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

  const startAudio = useCallback(
    async (silent = false) => {
      // A ref check, not just the "audio" state check callers already do: state updates are async, so a
      // caller firing rapidly (e.g. a stale onThumbsUp closure racing ahead of a re-render) could otherwise
      // slip through before "starting" actually lands, kicking off overlapping Rack.start() calls.
      if (startingRef.current) return;
      startingRef.current = true;
      setAudio("starting");
      try {
        const { Rack } = await import("@/audio/rack");
        const r = await Rack.start({ modules, bypassed: [...bypassed], delayDivision: division, stopped: silent });
        // Left this session while audio was starting: release the rack instead of leaking it.
        if (!aliveRef.current) {
          r.dispose();
          return;
        }
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
        if (!aliveRef.current) {
          r.dispose();
          return;
        }
        rackRef.current = r;
        setRack(r);
        setStopped(silent);
        setAudio("on");
      } catch {
        setAudio("error");
      } finally {
        startingRef.current = false;
      }
    },
    [bypassed, division, modules, params, source],
  );

  const changeBypass = useCallback((id: EffectId, off: boolean) => {
    rackRef.current?.setBypassed(id, off);
    setBypassToggled((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    setBypassed((prev) => {
      const next = new Set(prev);
      if (off) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const changeDivision = useCallback((d: Division | null) => {
    setDivision(d);
    const seconds = rackRef.current?.setDelayDivision(d);
    if (seconds !== undefined && Number.isFinite(seconds)) setParams((prev) => ({ ...prev, "delay.delayTime": seconds }));
  }, []);

  const changeDryHeld = useCallback((held: boolean) => {
    rackRef.current?.setDryHeld(held);
    setDryHeld(held);
    if (held) setAbUsed(true);
  }, []);

  const setAudioStopped = useCallback((next: boolean) => {
    const r = rackRef.current;
    if (!r) return;
    r.setStopped(next);
    setStopped(next);
  }, []);

  // An open hand held up for two seconds is a hands-free panic stop, same as Esc: it only stops, resuming is a deliberate click.
  const onOpenHand = useCallback(() => {
    if (!stopped) setAudioStopped(true);
  }, [stopped, setAudioStopped]);

  // A thumbs-up held long enough is a hands-free "Start audio" (mirroring the TopBar button's own
  // enabled condition) or, if the rack is already running but panic-stopped, a hands-free "Resume
  // audio". Browsers still gate AudioContext behind a real user gesture (click/tap/key) on at least
  // one prior interaction with the page, so starting from cold only actually unlocks sound once that
  // has happened; resuming an already-unlocked context has no such restriction.
  const onThumbsUp = useCallback(() => {
    if (audio === "on") {
      if (stopped) setAudioStopped(false);
      return;
    }
    if (audio !== "starting") void startAudio();
  }, [audio, stopped, setAudioStopped, startAudio]);

  // Esc is a panic stop. It only stops; resuming is a deliberate click.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.repeat) setAudioStopped(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setAudioStopped]);

  // The intro's first step: the loop is ready but silent until the first pinch.
  const startLoopNow = tour.step?.id === "start-loop" && audio === "on" && stopped && pinchedClosed(tour.seen, gestureValues);
  useEffect(() => {
    if (startLoopNow) setAudioStopped(false);
  }, [startLoopNow, setAudioStopped]);

  const beginTour = () => {
    tour.begin();
    stageRef.current?.startCamera();
    if (rackRef.current) setAudioStopped(true);
    else void startAudio(true);
  };

  const endTour = (completed: boolean) => {
    setAudioStopped(false);
    if (completed) setExpanded(true);
    tour.finish(completed);
  };

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

  const approve = useCallback(
    (p: Proposal) => {
      mappingChosenRef.current = true;
      setMapping(p.mapping);
      setSummary(p.summary);
      // A mapping on a bypassed effect would do nothing audible, so switch those effects on.
      for (const m of p.mapping.mappings) for (const t of m.targets) if (isEffectId(t.plugin)) changeBypass(t.plugin, false);
      fetch("/api/mappings", {
        method: "POST",
        headers: ownerHeaders(),
        body: JSON.stringify({ name: p.summary.slice(0, 120) || p.intent, intent: p.intent, mapping: p.mapping }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    },
    [changeBypass],
  );

  // Hand-pick what a gesture controls. No-ops if it would remove the mapping's last target
  // or exceed the per-gesture target limit; toggleTarget returns null in both cases.
  const toggleParam = useCallback(
    (gesture: Gesture, plugin: string, param: string) => {
      const next = toggleTarget(mapping, gesture, plugin, param);
      if (!next) return;
      setMapping(next);
      setSummary(summarizeMapping(next));
    },
    [mapping],
  );

  const loadPreset = useCallback(
    (p: Preset) => {
      const r = rackRef.current;
      const applied: Record<string, number> = {};
      for (const [key, value] of Object.entries(p.values)) {
        const [plugin, param] = key.split(".");
        applied[key] = r ? r.setParam(plugin, param, value) : value;
      }
      if (modules.includes("delay")) changeDivision(p.division);
      setParams((prev) => ({ ...prev, ...applied }));
      mappingChosenRef.current = true;
      setMapping(p.mapping);
      setSummary(p.summary);
      setActivePreset(p.id);
      setPresetsLoaded((prev) => new Set(prev).add(p.id));
    },
    [changeDivision, modules],
  );

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

  const resetMapping = () => {
    mappingChosenRef.current = true;
    setMapping(startMapping);
    setSummary(startSummary);
    setActivePreset(null);
    // Forget the saved mapping too, or the next visit would bring it straight back.
    if (!tutorial) fetch("/api/mappings", { method: "DELETE", headers: ownerHeaders(), signal: AbortSignal.timeout(5000) }).catch(() => {});
  };

  const signals: CoachSignals = { audioOn: audio === "on", abUsed, params, division, presetsLoaded, bypassToggled, asked };

  // Three columns from lg up keep the camera centered on the page. As the window narrows the side boxes
  // shrink toward 220px and the camera takes what is left; below lg everything stacks with the camera on top.
  const body = (
    <main className={`surface-${surface} flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:overflow-hidden`}>
      {/* Expanded camera: a clean landscape fills the border around it, and the side boxes float over it. */}
      {wide && <Landscape id="expand" className="fixed inset-0 z-[25]" />}
      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[clamp(220px,21vw,280px)_minmax(0,1fr)_clamp(220px,21vw,280px)] lg:gap-3 xl:grid-cols-[clamp(236px,22vw,296px)_minmax(0,1fr)_clamp(220px,21vw,280px)] xl:gap-4">
        {tour.shows("assistant") && (
          <div
            className={
              wide
                ? `${OVERLAY} left-8 w-[300px] xl:w-[316px] ${touring ? "panel-in" : ""}`
                : "order-2 flex flex-col gap-4 lg:order-none lg:col-start-1 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto"
            }
          >
            <section className="rounded-[var(--radius-panel)] glass" aria-label="AI assistant">
              <Collapsible title="AI assistant" defaultOpen>
                <Assistant
                  modules={modules}
                  activeSummary={summary}
                  onApprove={approve}
                  onResetDefault={resetMapping}
                  mapping={mapping}
                  onToggleParam={toggleParam}
                  lesson={tutorial ? { slug: tutorial.slug, asks: tutorial.asks, tries: tutorial.tries } : undefined}
                  onAsked={() => setAsked(true)}
                  tour={tour.step?.id === "assistant" ? { fallback: DREAMY_FALLBACK, onApplied: tour.noteAiApplied } : undefined}
                />
              </Collapsible>
            </section>
          </div>
        )}
        <div className="order-1 flex flex-col gap-4 lg:order-none lg:col-start-2 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto">
          {tutorial && !wide && <PresetBar presets={tutorial.presets} activeId={activePreset} onLoad={loadPreset} />}
          <Stage
            ref={stageRef}
            inputMode={inputMode}
            onInputModeChange={setInputMode}
            onCameraStatus={setCamera}
            onTracked={setTrackedValues}
            onOpenHand={onOpenHand}
            onLockChange={tour.noteLock}
            stopEnabled={!touring || tourStep === "palm"}
            lockEnabled={!touring || tourStep === "pinky" || tourStep === "rock"}
            onThumbsUp={onThumbsUp}
            fakeValues={fakeValues}
            onFakeChange={(g, v) => setFakeValues((prev) => ({ ...prev, [g]: v }))}
            values={gestureValues}
            chips={chips}
            expanded={wide}
            onToggleExpand={touring ? undefined : () => setExpanded((v) => !v)}
          />
          {/* Over the expanded camera, the spectrum floats as a slim bar beside the shrink button, clear of the pinch meters. */}
          {tour.shows("spectrum") && (
            <div
              className={wide ? `fixed right-[76px] bottom-7 z-40 w-[min(380px,calc(100vw-620px))] ${touring ? "panel-in" : ""}` : ""}
              data-tour="spectrum"
            >
              <Spectrum rack={rack} floating={wide} />
            </div>
          )}
        </div>
        {tour.shows("rack") && (
          <div
            className={
              wide
                ? `${OVERLAY} right-8 w-[280px] ${touring ? "panel-in" : ""}`
                : "order-3 flex flex-col gap-4 lg:order-none lg:col-start-3 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto"
            }
          >
            <RackPanel
              modules={modules}
              values={params}
              bound={bound}
              onManualChange={manualChange}
              rack={rack}
              showInput={isLiveSource(source)}
              bypassed={bypassed}
              onBypassChange={changeBypass}
              division={division}
              onDivisionChange={changeDivision}
              dryHeld={dryHeld}
              onDryHeldChange={changeDryHeld}
            />
          </div>
        )}
      </div>
    </main>
  );

  return (
    <div ref={rootRef} className="flex h-dvh flex-col">
      <TopBar
        lesson={tutorial ? { number: tutorial.number, title: tutorial.title } : undefined}
        audio={audio}
        onStartAudio={() => void startAudio(false)}
        stopped={stopped}
        onToggleStop={() => setAudioStopped(!stopped)}
        source={source}
        onSourceChange={changeSource}
        camera={camera}
        dbStatus={dbStatus}
        surface={surface}
        onSurfaceChange={SURFACE_SWITCH ? surfaceStore.set : undefined}
        onReplayIntro={tutorial || touring ? undefined : tour.replay}
      />

      {sourceError && (
        <div className="border-b border-border bg-danger/10 px-5 py-2 text-sm text-danger" role="alert">
          {sourceError}
        </div>
      )}
      {audio === "on" && stopped && !touring && (
        <div className="border-b border-border bg-danger/10 px-5 py-2 text-sm" role="status">
          Audio stopped. Gestures and the rack keep running silently. Click Resume audio to bring it back.
        </div>
      )}
      {audio !== "on" && (!touring || audio === "error") && (
        <p className="glass mx-auto mt-3 flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-sm">
          <span className={`size-1.5 rounded-full ${audio === "error" ? "bg-danger" : "bg-accent"}`} aria-hidden />
          {audio === "error" ? "Audio could not start. Click Retry audio." : "Click Start audio to hear the rack. Headphones recommended."}
        </p>
      )}

      {body}
      {tutorial && <TutorialCoach tutorial={tutorial} signals={signals} rootRef={rootRef} />}
      {touring && (
        <OnboardingCoach
          tour={tour}
          bound={bound}
          rootRef={rootRef}
          onBegin={beginTour}
          onSkip={() => endTour(false)}
          onFinish={() => endTour(true)}
        />
      )}
    </div>
  );
}
