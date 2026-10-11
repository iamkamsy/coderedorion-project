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

const FACTORIES: Record<EffectId, (v: Values) => EffectModule> = {
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
