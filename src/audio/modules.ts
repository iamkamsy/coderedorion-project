import * as Tone from "tone";
import type { EffectId } from "./rackSpec";

const RAMP_SECONDS = 0.05;

/** One effect in the rack. Owns its Tone nodes and disposes all of them. */
export interface EffectModule {
  readonly input: Tone.ToneAudioNode;
  readonly output: Tone.ToneAudioNode;
  /** Resolves once the module can make sound (the reverb builds its impulse response). */
  readonly ready: Promise<void>;
  /** Apply an already clamped value. Ramps wherever the parameter is a signal. */
  apply(param: string, value: number): void;
  dispose(): void;
}

function single<T extends Tone.ToneAudioNode>(
  node: T,
  apply: (node: T, param: string, value: number) => void,
  ready?: Promise<void>,
): EffectModule {
  return {
    input: node,
    output: node,
    ready: ready ?? Promise.resolve(),
    apply: (param, value) => apply(node, param, value),
    dispose: () => node.dispose(),
  };
}

type Values = Record<string, number>;

/** Distortion loses some of its level boost through this, so drive changes tone more than loudness. */
const DRIVE_MAKEUP_DB = -9;

const FACTORIES: Record<EffectId, (v: Values) => EffectModule> = {
  distortion: (v) => {
    const dist = new Tone.Distortion({ distortion: v["distortion.drive"], wet: v["distortion.wet"], oversample: "2x" });
    const makeup = new Tone.Gain(Tone.dbToGain(DRIVE_MAKEUP_DB * v["distortion.drive"]));
    dist.connect(makeup);
    return {
      input: dist,
      output: makeup,
      ready: Promise.resolve(),
      apply: (param, value) => {
        if (param === "drive") {
          // Regenerates the waveshaper curve; throttled via the schema.
          dist.distortion = value;
          makeup.gain.rampTo(Tone.dbToGain(DRIVE_MAKEUP_DB * value), RAMP_SECONDS);
        }
        if (param === "wet") dist.wet.rampTo(value, RAMP_SECONDS);
      },
      dispose: () => {
        dist.dispose();
        makeup.dispose();
      },
    };
  },

  phaser: (v) =>
    single(
      new Tone.Phaser({ frequency: v["phaser.frequency"], octaves: v["phaser.octaves"], baseFrequency: 350, wet: v["phaser.wet"] }),
      (ph, param, value) => {
        if (param === "frequency") ph.frequency.rampTo(value, RAMP_SECONDS);
        // Sweep range, not an audio gain; throttled via the schema.
        if (param === "octaves") ph.octaves = value;
        if (param === "wet") ph.wet.rampTo(value, RAMP_SECONDS);
      },
    ),

  filter: (v) =>
    single(new Tone.Filter({ type: "lowpass", frequency: v["filter.frequency"], Q: v["filter.Q"] }), (f, param, value) => {
      if (param === "frequency") f.frequency.rampTo(value, RAMP_SECONDS);
      if (param === "Q") f.Q.rampTo(value, RAMP_SECONDS);
    }),

  delay: (v) =>
    single(
      new Tone.FeedbackDelay({ delayTime: v["delay.delayTime"], feedback: v["delay.feedback"], wet: v["delay.wet"] }),
      (d, param, value) => {
        if (param === "wet") d.wet.rampTo(value, RAMP_SECONDS);
        if (param === "feedback") d.feedback.rampTo(value, RAMP_SECONDS);
        if (param === "delayTime") d.delayTime.rampTo(value, 0.1);
      },
    ),

  reverb: (v) => {
    const reverb = new Tone.Reverb({ decay: v["reverb.decay"], wet: v["reverb.wet"] });
    return single(
      reverb,
      (r, param, value) => {
        if (param === "wet") r.wet.rampTo(value, RAMP_SECONDS);
        // Regenerates the impulse response; throttled via the schema.
        if (param === "decay") r.decay = value;
      },
      reverb.ready,
    );
  },
};

export function createModule(id: EffectId, values: Values): EffectModule {
  return FACTORIES[id](values);
}
