import type { Tutorial } from "./types";

/** Tutorial 1, the demo tutorial. */
export const echoesInTime: Tutorial = {
  slug: "echoes-in-time",
  number: 1,
  title: "Echoes in time",
  tagline: "What a delay does, and how to make echoes groove.",
  idea: "A delay plays a copy of your sound a moment later. Feedback sends that copy back in, so you hear more and more echoes. Locking the delay to the beat makes the echoes part of the rhythm.",
  minutes: 3,
  status: "ready",
  modules: ["filter", "delay"],
  mapping: {
    mappings: [
      {
        gesture: "pinch_right",
        targets: [
          { plugin: "delay", param: "feedback", min: 0.05, max: 0.75, curve: "linear" },
          { plugin: "delay", param: "wet", min: 0.15, max: 0.55, curve: "linear" },
        ],
      },
    ],
  },
  summary: "Right pinch: open your fingers for more echoes, close them for fewer.",
  presets: [
    {
      id: "slapback",
      name: "Slapback",
      description: "One fast, short echo. The classic rockabilly and vocal sound.",
      values: { "delay.delayTime": 0.09, "delay.feedback": 0.08, "delay.wet": 0.35, "filter.frequency": 12000 },
      division: null,
      mapping: {
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "delay", param: "wet", min: 0.1, max: 0.5, curve: "linear" }] }],
      },
      summary: "Slapback: right pinch sets how loud the single echo is.",
    },
    {
      id: "dub",
      name: "Dub echo",
      description: "Long, repeating echoes that get darker as they fade, like a reggae dub mix.",
      values: { "delay.feedback": 0.6, "delay.wet": 0.45, "filter.frequency": 2200, "filter.Q": 1.5 },
      division: "4n.",
      mapping: {
        mappings: [
          {
            gesture: "pinch_right",
            targets: [
              { plugin: "delay", param: "feedback", min: 0.3, max: 0.8, curve: "linear" },
              { plugin: "filter", param: "frequency", min: 900, max: 4000, curve: "exp" },
            ],
          },
        ],
      },
      summary: "Dub echo: right pinch pushes the repeats and opens up the tone.",
    },
    {
      id: "dotted",
      name: "Dotted eighth",
      description: "Echoes that land between the beats, the shimmering sound of a lot of rock guitar.",
      values: { "delay.feedback": 0.35, "delay.wet": 0.35, "filter.frequency": 9000 },
      division: "8n.",
      mapping: {
        mappings: [{ gesture: "pinch_right", targets: [{ plugin: "delay", param: "feedback", min: 0.1, max: 0.6, curve: "linear" }] }],
      },
      summary: "Dotted eighth: right pinch sets how many echoes ring out.",
    },
  ],
  steps: [
    {
      id: "start",
      title: "Turn the sound on",
      body: "Click Start audio. You'll hear a short melody that loops. Headphones make the echoes much easier to hear.",
      target: "start-audio",
      check: { kind: "audio-on" },
    },
    {
      id: "dry",
      title: "Hear it without the delay",
      body: "Press and hold this button to hear the melody dry, with no effects. Let go to hear the echoes come back.",
      target: "ab",
      check: { kind: "ab-used" },
    },
    {
      id: "feedback",
      title: "More echoes",
      body: "Open your right thumb and index finger in front of the camera, or drag up on the stage. Feedback rises and each note repeats more times.",
      target: "param-delay.feedback",
      check: { kind: "param-above", key: "delay.feedback", value: 0.55 },
    },
    {
      id: "sync",
      title: "Lock it to the beat",
      body: "Pick 1/8. (dotted eighth). The echoes now land between the beats and turn into part of the rhythm instead of a blur.",
      target: "delay-division",
      check: { kind: "division-set", division: "8n." },
    },
    {
      id: "preset",
      title: "Try a classic",
      body: "Load Dub echo. Notice the filter makes the repeats darker, so they sit behind the melody instead of fighting it.",
      target: "preset-bar",
      check: { kind: "preset-loaded", preset: "dub" },
    },
    {
      id: "ask",
      title: "Ask anything",
      body: "Tap a question or type your own. The assistant explains in plain words, using the effects in this rack.",
      target: "assistant",
      check: { kind: "asked" },
    },
    {
      id: "recap",
      title: "You've got echoes",
      body: "Delay is time, feedback is how many repeats, and syncing makes echoes musical. Next, learn how distortion adds grit.",
      target: null,
      check: null,
    },
  ],
  asks: ["Why do dub echoes get darker?", "When should I sync the delay to the beat?", "What's the difference between delay and reverb?"],
  tries: ["Make it a slapback", "Give me huge, washy echoes", "Make the echoes darker"],
  recap: [
    "Delay time is how long until the copy plays.",
    "Feedback is how many times it repeats. Too much and it builds up, which is why it stops at 0.85 here.",
    "Syncing to a note division makes echoes groove with the beat.",
  ],
};
