import * as Tone from "tone";
import { clampToSchema, defaultParamValues, getParamSpec, paramKey } from "./paramSchema";

export type SourceKind = "loop" | "mic";

const RAMP_SECONDS = 0.05;
const LIMITER_THRESHOLD_DB = -6;

/**
 * Source -> Filter -> FeedbackDelay -> Reverb -> Limiter -> speakers.
 * The limiter is created with the rack and cannot be bypassed or removed.
 * Must be started from a user gesture (browser autoplay rules).
 */
export class Rack {
  private filter: Tone.Filter;
  private delay: Tone.FeedbackDelay;
  private reverb: Tone.Reverb;
  private limiter: Tone.Limiter;
  private preMeter: Tone.Meter;
  private postMeter: Tone.Meter;
  private fft: Tone.FFT;
  private input: Tone.Gain;

  private synth: Tone.PolySynth | null = null;
  private hat: Tone.NoiseSynth | null = null;
  private loop: Tone.Sequence<string | null> | null = null;
  private hatLoop: Tone.Loop | null = null;
  private mic: Tone.UserMedia | null = null;

  private lastApplied = new Map<string, number>();
  private pending = new Map<string, ReturnType<typeof setTimeout>>();
  readonly values: Record<string, number> = defaultParamValues();

  private constructor() {
    const v = this.values;
    this.input = new Tone.Gain(0.8);
    this.filter = new Tone.Filter({ type: "lowpass", frequency: v["filter.frequency"], Q: v["filter.Q"] });
    this.delay = new Tone.FeedbackDelay({ delayTime: v["delay.delayTime"], feedback: v["delay.feedback"], wet: v["delay.wet"] });
    this.reverb = new Tone.Reverb({ decay: v["reverb.decay"], wet: v["reverb.wet"] });
    this.limiter = new Tone.Limiter(LIMITER_THRESHOLD_DB);
    this.preMeter = new Tone.Meter({ smoothing: 0.8 });
    this.postMeter = new Tone.Meter({ smoothing: 0.8 });
    this.fft = new Tone.FFT(256);

    this.input.chain(this.filter, this.delay, this.reverb, this.limiter, Tone.getDestination());
    this.reverb.connect(this.preMeter);
    this.limiter.connect(this.postMeter);
    this.limiter.connect(this.fft);
  }

  static async start(): Promise<Rack> {
    await Tone.start();
    const rack = new Rack();
    await rack.reverb.ready;
    return rack;
  }

  /** Clamp to the schema and ramp to the new value. Never sets instantly. */
  setParam(plugin: string, param: string, value: number): number {
    const key = paramKey(plugin, param);
    const spec = getParamSpec(plugin, param);
    if (!spec) return NaN;
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
              this.applyNow(key, this.values[key]);
            }, wait),
          );
        }
        return safe;
      }
    }
    this.applyNow(key, safe);
    return safe;
  }

  private applyNow(key: string, value: number) {
    this.lastApplied.set(key, performance.now());
    switch (key) {
      case "reverb.wet":
        this.reverb.wet.rampTo(value, RAMP_SECONDS);
        break;
      case "reverb.decay":
        // Regenerates the impulse response; throttled via the schema.
        this.reverb.decay = value;
        break;
      case "delay.wet":
        this.delay.wet.rampTo(value, RAMP_SECONDS);
        break;
      case "delay.feedback":
        this.delay.feedback.rampTo(value, RAMP_SECONDS);
        break;
      case "delay.delayTime":
        this.delay.delayTime.rampTo(value, 0.1);
        break;
      case "filter.frequency":
        this.filter.frequency.rampTo(value, RAMP_SECONDS);
        break;
      case "filter.Q":
        this.filter.Q.rampTo(value, RAMP_SECONDS);
        break;
    }
  }

  async setSource(kind: SourceKind): Promise<void> {
    this.stopSources();
    if (kind === "mic") {
      this.mic = new Tone.UserMedia();
      await this.mic.open();
      this.mic.connect(this.input);
      return;
    }
    this.startLoop();
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

    Tone.getTransport().bpm.value = 96;
    Tone.getTransport().start();
  }

  private stopSources() {
    Tone.getTransport().stop();
    this.loop?.dispose();
    this.hatLoop?.dispose();
    this.synth?.dispose();
    this.hat?.dispose();
    this.mic?.close();
    this.mic?.dispose();
    this.loop = this.hatLoop = this.synth = this.hat = this.mic = null;
  }

  /** Spectrum in dB, one value per bin. */
  getSpectrum(): Float32Array {
    return this.fft.getValue();
  }

  /** Output level after the limiter, in dB. */
  getOutputLevel(): number {
    return toDb(this.postMeter.getValue());
  }

  /** True when the signal into the limiter is above its threshold. */
  isLimiting(): boolean {
    return toDb(this.preMeter.getValue()) > LIMITER_THRESHOLD_DB;
  }

  dispose() {
    this.stopSources();
    this.pending.forEach(clearTimeout);
    [this.input, this.filter, this.delay, this.reverb, this.limiter, this.preMeter, this.postMeter, this.fft].forEach((n) => n.dispose());
  }
}

function toDb(v: number | number[]): number {
  return Array.isArray(v) ? Math.max(...v) : v;
}
