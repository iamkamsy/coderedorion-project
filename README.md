# Gesture Rack

Shape your sound with your hands. A webcam tracks your hands in the browser. Pinching thumb and index finger drives audio effect parameters (reverb, delay, filter) in real time. Type an intent like "make it dreamier", and Gemini turns it into a validated mapping for your pinch. Every parameter move streams into TigerData for the dashboard.

Built for CodeRED Orion (Houston). Read [`CLAUDE.md`](CLAUDE.md) for the product, rules and schedule, and [`HANDOFF.md`](HANDOFF.md) for the work packages.

---

## Quick start

### 1. Install the tools (one time)

| Tool        | Version                        | How to install                                                               |
| ----------- | ------------------------------ | ---------------------------------------------------------------------------- |
| **Git**     | any recent                     | macOS: `xcode-select --install`. Windows: <https://git-scm.com/download/win> |
| **Node.js** | **24 LTS** (22 or newer works) | <https://nodejs.org> (pick the LTS installer), or with nvm: `nvm install 24` |
| **pnpm**    | 10.x                           | After Node is installed: `corepack enable` (or `npm install -g pnpm`)        |

Check them:

```bash
node -v    # v22 or newer
pnpm -v    # 10.x
```

You do **not** need to install Next.js, React, Tone.js or MediaPipe yourself. `pnpm install` pulls them all from `package.json`.

### 2. Clone and install

```bash
git clone https://github.com/iamkamsy/coderedorion-project.git
cd coderedorion-project
pnpm install
```

`pnpm install` also copies the MediaPipe hand-tracking runtime into `public/mediapipe/` (the `postinstall` script). The hand model is already committed at `public/models/hand_landmarker.task`.

### 3. Environment variables (optional for local dev)

```bash
cp .env.example .env.local
```

Fill in whichever keys you have. Get them from the team password manager, never from chat. **Every key is optional.** Without one, that feature shows a clear error, and the pinch and rack keep working.

| Variable                                    | Used for                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`                            | Chat to mapping (`/api/mapping`)                                                                   |
| `GEMINI_MODEL`                              | Optional model override (default `gemini-3.1-flash-lite`, fast and light on free-tier rate limits) |
| `DATABASE_URL`                              | TigerData Postgres: event stream, saved mappings, dashboard                                        |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` | Lesson coach voice (`/api/speak`), in the agent's configured voice                                 |
| `BACKBOARD_API_KEY`                         | Not used yet (memory)                                                                              |

### 4. Run it

```bash
pnpm dev
```

Open <http://localhost:3000> in **Chrome**. Click **Start audio**, then either:

- click **Enable camera** and pinch thumb and index finger in front of the webcam, or
- drag up and down on the stage (or use the **Fake pinch** sliders) if you have no camera.

**Stop audio** in the top bar (or **Esc** anywhere) fades the output to silence in about 50 ms. Tracking and inputs keep running, so **Resume audio** brings the sound back instantly.

Use headphones, especially with a live source. The audio source menu has three options:

- **Test loop**: built-in synth, no input needed.
- **Vocal mic**: browser noise suppression on, 100 Hz low cut, and a noise gate. Use a close headset mic in noisy rooms. The gate only mutes the gaps between phrases; it cannot remove loud music _while_ you sing.
- **Instrument / line in**: raw signal (no suppression, so the tone survives) with a 40 Hz low cut. Use an audio interface for guitar.

The rack's **Input** module sets the low cut and gate threshold, and shows whether the gate is open. Plans for separate voice-command and instrument inputs are in [`docs/plans/dual-input.md`](docs/plans/dual-input.md).

### 5. Set up the database (DevOps, once per database)

With `DATABASE_URL` in `.env.local`:

```bash
pnpm db:migrate
```

This applies `db/migrations/*.sql` in order and records each one in `schema_migrations`. It creates the tables, the `param_events` hypertable, the `param_events_1m` continuous aggregate, RLS policies, and a `gesture_app` role that the API switches to for each request.

---

## Scripts

| Command                     | What it does                                                 |
| --------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                  | Dev server on port 3000                                      |
| `pnpm build` / `pnpm start` | Production build and serve                                   |
| `pnpm lint`                 | ESLint                                                       |
| `pnpm typecheck`            | TypeScript, strict                                           |
| `pnpm test`                 | Vitest unit tests (mapping validation, clamping, pinch math) |
| `pnpm check`                | lint + typecheck + test. Run before every push               |
| `pnpm format`               | Prettier                                                     |
| `pnpm db:migrate`           | Apply SQL migrations to `DATABASE_URL`                       |

CI (lint, typecheck, test, build on every PR) lands in a follow-up `chore/ci` PR.

---

## How it works

```
Webcam -> MediaPipe Hand Landmarker (browser) -> pinch ratio -> One Euro filter -> 0..1 per hand
      -> mapping engine (scale + curve + clamp) -> Tone.js rack: Filter -> Delay -> Reverb -> Limiter
      -> event batcher (~1/s) -> POST /api/events -> TigerData hypertable -> continuous aggregate -> /dashboard

Chat intent -> POST /api/mapping -> Gemini (structured JSON) -> validate + clamp -> proposed card -> Approve -> live
```

- **Video never leaves the browser.** Tracking and audio run client side.
- **Limiter is always on.** Every parameter is clamped to its safe range in `src/audio/paramSchema.ts`, and every change ramps.
- **Gemini output is untrusted.** It is validated on the server and again on the client.

## Lessons (`/learn`)

Three bite-sized lessons for beginners. Each one loads a small rack with only the effects it teaches, plus presets, a step-by-step coach and an assistant that can answer questions:

1. **Echoes in time** (filter, delay): the demo lesson
2. **Grit and warmth** (distortion, filter): preview
3. **Movement** (phaser, reverb): preview

Lessons are data files in `src/tutorials/`. To add one, copy an existing file, add it to `src/tutorials/index.ts`, and run `pnpm test`, which checks every preset, mapping, step target and check against the real rack. Each lesson visit is an isolated session (its own rack, data session and state); see `docs/plans/tutorials.md`.

## Project layout

```
src/
  app/              pages (/ and /dashboard) and API route handlers (app/api/*)
  audio/            paramSchema.ts (single source of truth for params), rackSpec.ts, modules.ts, rack.ts (Tone.js)
  gesture/          pinch.ts (ratio + calibration), oneEuro.ts, tracker.ts (MediaPipe)
  tutorials/        lesson data (Zod-validated), coach checks
  mapping/          types.ts (the mapping contract + Zod), validate.ts, engine.ts, defaults.ts
  ai/               gemini.ts (server only)
  db/               client.ts (server only, RLS owner scoping)
  components/       Studio, Stage, RackPanel, Assistant, Spectrum, TopBar, Dashboard
  lib/              owner id, event batcher, formatting
db/migrations/      SQL migrations (tables, hypertable, aggregate, RLS)
scripts/            migrate.mjs, copy-mediapipe.mjs
```

## Team workflow

- **Never push to `main`.** Branch per task: `feat/<name>`, `fix/<name>`, `chore/<name>`. Open a PR, get one approval, squash merge.
- **No co-author trailers or "Generated with" lines** in commits or PRs.
- **Never commit `.env*` files.** Only `.env.example` is tracked.
- Run `pnpm check` before pushing.

## Troubleshooting

- **No sound:** click **Start audio** first (browsers block audio until you click). Check the system output device.
- **Camera blocked:** allow the camera in the browser's site settings and reload. The fake pinch always works.
- **Hand tracking failed to load:** run `pnpm install` again so `public/mediapipe/wasm` exists.
- **Pinch range feels off:** click **Calibrate pinch** under the stage and follow the prompts.
- **"Data offline" in the top bar:** `DATABASE_URL` is missing or unreachable, or migrations have not run.
- **`pnpm: command not found`:** run `corepack enable`, then open a new terminal.
