import type { Tutorial } from "./types";

export const movement: Tutorial = {
  slug: "movement",
  number: 3,
  title: "Movement",
  tagline: "Effects that change over time: rate, depth and mix.",
  idea: "A phaser sweeps a set of notches up and down your sound, so it seems to swirl. Rate is how fast it sweeps, depth is how far, and mix is how much of the swirl you hear.",
  minutes: 3,
  status: "preview",
  modules: ["phaser", "reverb"],
  mapping: {
    mappings: [{ gesture: "pinch_right", targets: [{ plugin: "phaser", param: "frequency", min: 0.2, max: 6, curve: "exp" }] }],
  },
  summary: "Right pinch: open your fingers to speed up the swirl.",
  presets: [
    {
      id: "swirl",
      name: "Slow swirl",
      description: "A slow, gentle sweep that makes chords shimmer.",
      values: { "phaser.frequency": 0.3, "phaser.octaves": 3, "phaser.wet": 0.5, "reverb.wet": 0.3 },
      division: null,
      mapping: {
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "phaser", param: "wet", min: 0.2, max: 0.8, curve: "linear" }] }],
      },
      summary: "Slow swirl: right pinch sets how much swirl you hear.",
    },
    {
      id: "jet",
      name: "Jet",
      description: "A deep, slow sweep that sounds like a plane flying past.",
      values: { "phaser.frequency": 0.4, "phaser.octaves": 5.5, "phaser.wet": 0.8, "reverb.wet": 0.25 },
      division: null,
      mapping: {
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "phaser", param: "octaves", min: 2, max: 6, curve: "linear" }] }],
      },
      summary: "Jet: right pinch sets how deep the sweep goes.",
    },
    {
      id: "wobble",
      name: "Wobble",
      description: "A fast, shallow sweep with a rubbery, vibrating feel.",
      values: { "phaser.frequency": 5, "phaser.octaves": 2, "phaser.wet": 0.6, "reverb.wet": 0.15 },
      division: null,
      mapping: {
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "phaser", param: "frequency", min: 2, max: 8, curve: "exp" }] }],
      },
      summary: "Wobble: right pinch sets the wobble speed.",
    },
  ],
  steps: [
    {
      id: "start",
      title: "Turn the sound on",
      body: "Click Start audio and listen for a slow swirl in the melody.",
      target: "start-audio",
      check: { kind: "audio-on" },
    },
    {
      id: "rate",
      title: "Speed it up",
      body: "Open your right hand (or drag up on the stage) to raise the Rate above 3 Hz. Slow sweeps feel dreamy, fast ones feel like a wobble.",
      target: "param-phaser.frequency",
      check: { kind: "param-above", key: "phaser.frequency", value: 3 },
    },
    {
      id: "depth",
      title: "Go deeper",
      body: "Drag Depth above 4 octaves. The sweep travels further, so the movement becomes more dramatic.",
      target: "param-phaser.octaves",
      check: { kind: "param-above", key: "phaser.octaves", value: 4 },
    },
    {
      id: "bypass",
      title: "Switch it off and on",
      body: "Flip the Phaser switch to bypass it. Toggling an effect is the fastest way to hear what it is really doing.",
      target: "bypass-phaser",
      check: { kind: "bypass-toggled", plugin: "phaser" },
    },
    {
      id: "preset",
      title: "Fly a jet",
      body: "Load Jet for the classic deep phaser sweep.",
      target: "preset-bar",
      check: { kind: "preset-loaded", preset: "jet" },
    },
    {
      id: "recap",
      title: "Sound in motion",
      body: "Rate is speed, depth is distance, and mix is how much you hear. These three ideas apply to chorus, flanger and tremolo too.",
      target: null,
      check: null,
    },
  ],
  asks: [
    "What's the difference between a phaser and a chorus?",
    "Why does a phaser sound like it's moving?",
    "When would I use a slow rate?",
  ],
  tries: ["Make it swirl slowly", "Make it sound like a jet", "Make it wobble fast"],
  recap: [
    "Modulation effects change over time.",
    "Rate is how fast, depth is how far, and mix is how much you hear.",
    "Bypassing an effect is the quickest way to hear what it does.",
  ],
};
