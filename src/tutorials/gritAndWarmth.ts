import type { Tutorial } from "./types";

export const gritAndWarmth: Tutorial = {
  slug: "grit-and-warmth",
  number: 2,
  title: "Grit and warmth",
  tagline: "How distortion adds harmonics, and why it gets loud.",
  idea: "Distortion clips the top of your sound wave, which adds new, higher harmonics. A little sounds warm, a lot sounds fuzzy. It also makes things louder, which is why a limiter guards the output.",
  minutes: 3,
  status: "preview",
  modules: ["distortion", "filter"],
  mapping: {
    mappings: [{ gesture: "pinch_right", targets: [{ plugin: "distortion", param: "drive", min: 0, max: 0.85, curve: "linear" }] }],
  },
  summary: "Right pinch: open your fingers to push the drive harder.",
  presets: [
    {
      id: "tape",
      name: "Warm tape",
      description: "Gentle saturation that thickens a sound without obvious fuzz.",
      values: { "distortion.drive": 0.2, "distortion.wet": 0.7, "filter.frequency": 9000 },
      division: null,
      mapping: {
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "distortion", param: "drive", min: 0.05, max: 0.35, curve: "linear" }] }],
      },
      summary: "Warm tape: right pinch adds a little more warmth.",
    },
    {
      id: "crunch",
      name: "Crunch",
      description: "Medium drive, like an amp turned up just past clean.",
      values: { "distortion.drive": 0.45, "distortion.wet": 1, "filter.frequency": 6000 },
      division: null,
      mapping: {
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "distortion", param: "drive", min: 0.3, max: 0.6, curve: "linear" }] }],
      },
      summary: "Crunch: right pinch moves between edgy and crunchy.",
    },
    {
      id: "fuzz",
      name: "Fuzz",
      description: "Heavy, buzzing drive with the harsh top end tamed by the filter.",
      values: { "distortion.drive": 0.85, "distortion.wet": 1, "filter.frequency": 3000, "filter.Q": 1.2 },
      division: null,
      mapping: {
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "filter", param: "frequency", min: 1200, max: 6000, curve: "exp" }] }],
      },
      summary: "Fuzz: right pinch opens and closes the tone.",
    },
  ],
  steps: [
    {
      id: "start",
      title: "Turn the sound on",
      body: "Click Start audio to hear the loop through the distortion.",
      target: "start-audio",
      check: { kind: "audio-on" },
    },
    {
      id: "drive",
      title: "Push the drive",
      body: "Open your right hand slowly (or drag up on the stage). Listen for the point where warm turns into fuzzy.",
      target: "param-distortion.drive",
      check: { kind: "param-above", key: "distortion.drive", value: 0.5 },
    },
    {
      id: "limiter",
      title: "Watch the limiter",
      body: "More drive means more level. When the badge says Limiter active, it is catching peaks so your ears and speakers stay safe.",
      target: "output-meter",
      check: null,
    },
    {
      id: "tone",
      title: "Tame the fizz",
      body: "Drag the filter Cutoff below 4 kHz. Distortion adds harsh high harmonics, and the filter smooths them out.",
      target: "param-filter.frequency",
      check: { kind: "param-below", key: "filter.frequency", value: 4000 },
    },
    {
      id: "preset",
      title: "Try the extremes",
      body: "Load Fuzz, then Warm tape. Same effect, very different feel.",
      target: "preset-bar",
      check: { kind: "preset-loaded", preset: "fuzz" },
    },
    {
      id: "recap",
      title: "Grit, under control",
      body: "Drive adds harmonics and loudness, and a filter after distortion shapes its tone. Next: effects that move.",
      target: null,
      check: null,
    },
  ],
  asks: ["What's the difference between overdrive and fuzz?", "Why put a filter after distortion?", "Why does distortion get louder?"],
  tries: ["Make it warm, not fuzzy", "Make it as fuzzy as possible", "Make the fuzz less harsh"],
  recap: [
    "Distortion clips the wave and adds harmonics.",
    "More drive is louder, and the limiter catches the peaks.",
    "A filter after distortion shapes its tone.",
  ],
};
