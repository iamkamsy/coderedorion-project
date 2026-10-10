import * as Tone from "tone";
import { LIVE_SOURCES, isLiveSource, type SourceKind } from "./inputs";
import { createModule, type EffectModule } from "./modules";
import { clampToSchema, getParamSpec, paramKey } from "./paramSchema";
import { STUDIO_MODULES, defaultValuesFor, orderModules, type EffectId } from "./rackSpec";

export type { SourceKind };

const RAMP_SECONDS = 0.05;
const LIMITER_THRESHOLD_DB = -6;
/** Fade time for stop and resume, long enough to avoid a click. */
const STOP_RAMP_SECONDS = 0.05;
export const LOOP_BPM = 96;

export interface RackOptions {
  /** Effects to load. Always chained in signal order. Defaults to the full studio. */
  modules?: readonly EffectId[];
}

/**
 * Live input -> Low cut -> Gate --+
 *                                 +-> [effect modules in signal order] -> Master -> Limiter -> speakers.
 * Test loop ----------------------+
 *
 * Each rack owns every node, timer and stream it creates, and dispose() releases all of
 * them and resets Tone's page-wide Transport, so nothing carries over to the next rack.
 * The limiter is created with the rack and cannot be bypassed or removed. Master is the
 * stop/resume fader; inputs stay open while stopped so resuming is instant.
 * Must be started from a user gesture (browser autoplay rules).
 */
export class Rack {
  readonly modules: readonly EffectId[];
  readonly values: Record<string, number>;

  private effects = new Map<EffectId, EffectModule>();
  private master: Tone.Gain;
  private limiter: Tone.Limiter;
  private stopped = false;
  private disposed = false;
  private preMeter: Tone.Meter;
  private postMeter: Tone.Meter;
  private fft: Tone.FFT;
  private input: Tone.Gain;
  private liveIn: Tone.Gain;
  private lowCut: Tone.Filter;
  private gate: Tone.Gate;
  private gateMeter: Tone.Meter;

  private synth: Tone.PolySynth | null = null;
  private hat: Tone.NoiseSynth | null = null;
  private loop: Tone.Sequence<string | null> | null = null;
  private hatLoop: Tone.Loop | null = null;
  private stream: MediaStream | null = null;
  private streamSource: MediaStreamAudioSourceNode | null = null;
  private source: SourceKind = "loop";

  private lastApplied = new Map<string, number>();
  private pending = new Map<string, ReturnType<typeof setTimeout>>();

  private constructor(modules: readonly EffectId[]) {
    this.modules = orderModules(modules);
    this.values = defaultValuesFor(this.modules);
    const v = this.values;

    this.input = new Tone.Gain(0.8);
    this.liveIn = new Tone.Gain(1);
    this.lowCut = new Tone.Filter({ type: "highpass", frequency: v["input.lowCut"], rolloff: -24 });
    this.gate = new Tone.Gate({ threshold: v["input.gateThreshold"], smoothing: 0.05 });
    this.gateMeter = new Tone.Meter({ smoothing: 0.6 });
    this.limiter = new Tone.Limiter(LIMITER_THRESHOLD_DB);
    this.master = new Tone.Gain(1);
    this.preMeter = new Tone.Meter({ smoothing: 0.8 });
    this.postMeter = new Tone.Meter({ smoothing: 0.8 });
    this.fft = new Tone.FFT(256);

    this.liveIn.chain(this.lowCut, this.gate, this.input);
    this.lowCut.connect(this.gateMeter);

    let tail: Tone.ToneAudioNode = this.input;
    for (const id of this.modules) {
      const effect = createModule(id, v);
      this.effects.set(id, effect);
      tail.connect(effect.input);
      tail = effect.output;
    }
    tail.chain(this.master, this.limiter, Tone.getDestination());
    this.master.connect(this.preMeter);
    this.limiter.connect(this.postMeter);
    this.limiter.connect(this.fft);
  }

  static async start(options: RackOptions = {}): Promise<Rack> {
    await Tone.start();
    const rack = new Rack(options.modules ?? STUDIO_MODULES);
    await Promise.all([...rack.effects.values()].map((m) => m.ready));
    return rack;
  }

  /** True if this rack exposes the parameter (the input stage or a loaded effect). */
  hasParam(plugin: string, param: string): boolean {
    return paramKey(plugin, param) in this.values;
  }

  /** Clamp to the schema and ramp to the new value. Never sets instantly. Ignores params this rack does not load. */
  setParam(plugin: string, param: string, value: number): number {
    const key = paramKey(plugin, param);
    const spec = getParamSpec(plugin, param);
    if (!spec || this.disposed || !this.hasParam(plugin, param)) return NaN;
    const safe = clampToSchema(plugin, param, value);
    this.values[key] = safe;

    if (spec.throttleMs) {
      const last = this.lastApplied.get(key) ?? 0;
      const wait = spec.throttleMs - (performance.now() - last);
      if (wait > 0) {
        if (!this.pending.has(key)) {
          this.pending.set(
            key,
            setTimeout(() => {
              this.pending.delete(key);
              this.applyNow(plugin, param, this.values[key]);
            }, wait),
          );
        }
        return safe;
      }
    }
    this.applyNow(plugin, param, safe);
    return safe;
  }

  private applyNow(plugin: string, param: string, value: number) {
    if (this.disposed) return;
    this.lastApplied.set(paramKey(plugin, param), performance.now());
    if (plugin === "input") {
      if (param === "lowCut") this.lowCut.frequency.rampTo(value, RAMP_SECONDS);
      // A comparison level, not an audio gain, so an instant change cannot click.
      if (param === "gateThreshold") this.gate.threshold = value;
      return;
    }
    this.effects.get(plugin as EffectId)?.apply(param, value);
  }

  /** Switch the source. Live sources open the mic with constraints suited to voice or instrument. */
  async setSource(kind: SourceKind): Promise<void> {
    this.stopSources();
    this.source = kind;
    if (!isLiveSource(kind)) {
      this.startLoop();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: LIVE_SOURCES[kind].constraints, video: false });
    // The rack may have been disposed (tutorial left) while the permission prompt was open.
    if (this.disposed || this.source !== kind) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    this.streamSource = Tone.getContext().createMediaStreamSource(stream);
    this.streamSource.connect(this.liveIn.input);
  }

  private startLoop() {
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.4 },
      volume: -10,
    }).connect(this.input);
    this.hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
      volume: -28,
    }).connect(this.input);

    const notes = ["C4", "E4", "G4", "B4", null, "A4", "G4", null, "F4", "A4", "C5", "E5", null, "D5", "C5", null];
    this.loop = new Tone.Sequence<string | null>(
      (time, note) => {
        if (note) this.synth?.triggerAttackRelease(note, "16n", time);
      },
      notes,
      "8n",
    ).start(0);
    this.hatLoop = new Tone.Loop((time) => this.hat?.triggerAttackRelease("32n", time), "4n").start("8n");

    Tone.getTransport().bpm.value = LOOP_BPM;
    Tone.getTransport().start();
  }

  private stopSources() {
    resetTransport();
    this.loop?.dispose();
    this.hatLoop?.dispose();
    this.synth?.dispose();
    this.hat?.dispose();
    this.streamSource?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.loop = this.hatLoop = this.synth = this.hat = null;
    this.stream = this.streamSource = null;
  }

  /** Fade the output to silence (or back). Sources and inputs keep running. */
  setStopped(stopped: boolean) {
    if (this.disposed) return;
    this.stopped = stopped;
    this.master.gain.cancelScheduledValues(Tone.now());
    this.master.gain.rampTo(stopped ? 0 : 1, STOP_RAMP_SECONDS);
  }

  isStopped(): boolean {
    return this.stopped;
  }

  /** Spectrum in dB, one value per bin. */
  getSpectrum(): Float32Array {
    return this.fft.getValue();
  }

  /** Output level after the limiter, in dB. */
  getOutputLevel(): number {
    return toDb(this.postMeter.getValue());
  }

  /** Whether the input gate is passing signal, or null when the source is not live. */
  isGateOpen(): boolean | null {
    if (!isLiveSource(this.source)) return null;
    return toDb(this.gateMeter.getValue()) > this.values["input.gateThreshold"];
  }

  /** True when the signal into the limiter is above its threshold. */
  isLimiting(): boolean {
    return toDb(this.preMeter.getValue()) > LIMITER_THRESHOLD_DB;
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  /** Release every node, timer and stream this rack created. Safe to call twice. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopSources();
    this.pending.forEach(clearTimeout);
    this.pending.clear();
    this.effects.forEach((m) => m.dispose());
    this.effects.clear();
    [
      this.liveIn,
      this.lowCut,
      this.gate,
      this.gateMeter,
      this.input,
      this.master,
      this.limiter,
      this.preMeter,
      this.postMeter,
      this.fft,
    ].forEach((n) => n.dispose());
  }
}

/** Tone's Transport is shared by the whole page: stop it and clear everything scheduled on it. */
function resetTransport() {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel(0);
  transport.position = 0;
  transport.bpm.value = LOOP_BPM;
}

function toDb(v: number | number[]): number {
  return Array.isArray(v) ? Math.max(...v) : v;
}
