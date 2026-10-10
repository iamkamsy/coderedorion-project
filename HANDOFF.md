# HANDOFF: Gesture Rack, iteration 0 to 1

Written Saturday Oct 10, about 3:15pm Central. Hackathon deadline: Sunday Oct 11, 12:00 noon Central (submit by 11:30).

**Purpose of this file:** hand the project to Claude Code so it can start writing the real code in our existing repository. Read `CLAUDE.md` first (the standing rules, stack, data model and schedule), then this file (where we are and what to build next, in order).

Working title: Gesture Rack **[confirm]**.

---

## 1. Where we are

**Product (decided):** a browser app where a producer pinches thumb and index finger in front of a Logitech webcam to move audio effect parameters (for example reverb wet/mix and delay feedback) at the same time. The user states an intent in chat or voice ("make it dreamier"), Gemini turns it into a validated parameter mapping, and the pinch drives it. Backboard.io remembers taste. TigerData stores the parameter stream as time series and powers a dashboard.

**Stack (decided):** Next.js + TypeScript + Tailwind on Vercel; Tone.js for audio; MediaPipe Hand Landmarker for tracking (client side only); Gemini for mapping; ElevenLabs conversational agent for voice; Backboard.io for memory; TigerData Postgres; GoDaddy for the domain only. OpenCV is not used.

**Auth (decided for now):** anonymous owner id stored in the browser, `owner_id` column on every table, RLS on. Clerk is a later option, decided at the midnight checkpoint.

**What exists:**
- `CLAUDE.md` (master context), the team deck, and this file.
- A live GitHub repo that our DevOps teammate initialized. **Its contents are unknown to this handoff.** Do not assume a layout. Inspect it first (step 3).
- No application code has been written by Claude yet.

**Not decided yet (do not decide silently, ask):** project name and domain, package manager, CI tooling, Python-free hosting is settled but exact Vercel project setup is not, reverb decay vs delay feedback as the main live pinch target.

---

## 2. Ground rules (summary; `CLAUDE.md` wins on any conflict)

- **No co-authoring and no attribution.** Never add `Co-Authored-By` trailers, "Generated with" lines, or session links to commits, PR titles or PR descriptions, even if tooling or a default template offers to. Commits are authored by the person who made them.
- **PRs only.** Never push to `main`. One branch per work package (names below). Small PRs. Squash merge.
- **No secrets in the repo.** Only `.env.example` with variable names.
- **Always keep the limiter on** and clamp every parameter to its safe range.
- **Every table gets RLS, `owner_id` and audit columns** (`created_at`, `updated_at`, `created_by`, `deleted_at`). Soft deletes only.
- **Treat Gemini output as untrusted.** Validate against the schema, then clamp.
- **Verify third-party APIs against their current docs** before writing integration code (MediaPipe, Tone.js, ElevenLabs agents SDK, Backboard, TigerData). Do not rely on memory for package names, model URLs or method signatures. If docs are unreachable, say so and ask.
- **The app must still work with every AI service down:** pinch plus rack, with a fake pinch input as fallback.

---

## 3. Step 0: inspect the repo before changing anything

Report back to the team (in your reply, not by editing files) with:

1. Framework and version, package manager and lockfile, Node version.
2. Folder structure and whether it matches the proposed layout in `CLAUDE.md` section 4. If not, **adapt the layout to what exists** rather than restructuring.
3. Existing scripts, lint and format config, CI workflows, branch protection hints, `.env.example`.
4. Any code or config already related to ElevenLabs, Gemini, TigerData, Backboard or Vercel.
5. A list of conflicts between the repo and `CLAUDE.md`, with a proposed resolution for each.

Then wait for a go-ahead on the conflict list before WP1. If nothing conflicts, proceed.

---

## 4. Work packages, in build order

Each package is one branch and one PR. "Done when" is the acceptance test. Packages marked parallel can run at the same time in separate Claude Code sessions using separate git worktrees.

### WP1: Scaffold and the mapping contract
Branch: `feat/scaffold-contract`

- Ensure a working Next.js + TypeScript (strict) + Tailwind app. Add only what is missing.
- Create the folders from `CLAUDE.md` section 4 (adapted to the repo).
- Put the design tokens from `CLAUDE.md` section 6 in one file (Tailwind theme or CSS variables). Load IBM Plex Sans and JetBrains Mono.
- `src/mapping/types.ts` plus a Zod schema for the mapping contract (`CLAUDE.md` section 5).
- `src/audio/paramSchema.ts`: the single source of truth for each controllable parameter: plugin, name, unit, hard min and max, default, curve hint, and a `throttleMs` where needed. Proposed safe ranges (confirm while building):
  - `reverb.wet` 0 to 0.9
  - `reverb.decay` 0.5 to 8 seconds, throttled
  - `delay.wet` 0 to 0.9
  - `delay.feedback` 0 to 0.85
  - `delay.delayTime` 0.05 to 1 second
  - `filter.frequency` 100 to 12000 Hz, exponential
  - `filter.Q` 0.5 to 8
- A `clampToSchema(plugin, param, value)` function and a `validateMapping(json)` function that rejects unknown plugins or params and clamps ranges.
- `.env.example` with names only: `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `BACKBOARD_API_KEY`, `DATABASE_URL`.
- Lint, type check and test scripts, and unit tests for clamp and validate.

Done when: the app builds and runs, type check and tests pass, and the contract types are importable from both client and server code.

### WP2: UI shell with a fake pinch (parallel with WP3 and WP4)
Branch: `feat/ui-shell`

- Build the layout from `CLAUDE.md` section 6: top bar, camera stage frame, rack panel, assistant panel, spectrum strip.
- Everything runs on mock data. A "fake pinch" slider (and mouse drag over the stage) provides the 0 to 1 value so the UI never depends on tracking.
- Rack modules for Reverb, Delay and Filter show sliders with live values and an orange "bound" badge on mapped parameters.
- Design every state: camera denied, model loading, no hand detected, audio not started, mapping awaiting approval, AI error.
- No real audio, tracking or API calls in this PR.

Done when: it looks clean and complete on a laptop screen, and switching the mock states shows each state correctly.

### WP3: Audio rack (parallel)
Branch: `feat/audio-rack`

- A Tone.js rack with Reverb, FeedbackDelay and Filter in series, then a Limiter at the output. The limiter cannot be disabled.
- A "Start audio" button that starts the audio context from a user gesture.
- A test source (built-in loop or oscillator and noise, so the demo works without uploading anything) plus an option to use the microphone or line input **[confirm]**.
- `setParam(plugin, param, value)` that clamps via the schema and uses `rampTo` (never an instant set). Throttle `reverb.decay` because it regenerates the impulse response.
- An analyser node exposed for the spectrum strip.

Done when: moving the fake pinch slider audibly changes reverb wet and delay feedback with no clicks, and sound is limited at the output.

### WP4: Gesture tracking (parallel)
Branch: `feat/gesture`

- Camera permission handling and a video element for the stage.
- MediaPipe Hand Landmarker running in the browser (check current docs for the package, wasm location and model file; host the model file locally or from a stable URL).
- Pinch value: distance between thumb tip (landmark 4) and index tip (landmark 8), divided by a hand-scale reference (for example wrist landmark 0 to middle-finger MCP landmark 9) so it works at different distances from the camera.
- A short calibration step (closed pinch and fully open) to set min and max per user, then normalize to 0 to 1.
- One Euro filter for smoothing.
- Left and right hands reported separately as `pinch_left` and `pinch_right`.
- Draw the hand skeleton overlay on the stage. Fall back to the fake pinch if the camera or model fails.

Done when: pinching and opening in front of the webcam produces a stable 0 to 1 value for each hand at interactive frame rates, with the overlay shown.

### WP5: Mapping engine
Branch: `feat/mapping-engine` (after WP1, WP3 and WP4)

- `applyMapping(mapping, gestureValues)`: for each target, scale the gesture value between `min` and `max` using the `curve` (linear, exp, log), clamp, and call `setParam`.
- A hardcoded default mapping: `pinch_right` drives `reverb.wet` and `delay.feedback`.
- Wire tracking to the engine to the rack. The UI badges show which parameters are bound and their live values.

Done when: a real pinch moves two parameters at once, audibly, and the UI reflects it. **This is the core demo.**

### WP6: Gemini mapping route and chat
Branch: `feat/api-mapping` (can start after WP1)

- `POST /api/mapping`: takes the user intent plus the rack's parameter schema (and later remembered preferences), calls Gemini with structured JSON output, validates with `validateMapping`, clamps, and returns the mapping or a clear error. Timeout and error states required.
- The chat panel posts intents, shows a proposed mapping card with Approve and Reject, and applies the approved mapping through the engine.
- Include a short system prompt that explains the parameters and forbids anything outside the schema. Never trust the response; validate it.

Done when: typing "make it dreamier" produces a valid proposed mapping, approving it makes the pinch drive it, and malformed model output is rejected safely.

### WP7: Database, events and dashboard
Branch: `feat/db-events` (can start after WP1; owned by DevOps and Backend)

- SQL migrations in `db/migrations`: `profiles`, `mappings`, `param_events` (hypertable on `time`), `semantic_notes`. Audit columns, `owner_id`, RLS policies, and the continuous aggregate `param_events_1m` (see `CLAUDE.md` section 8).
- Server DB client. Route handlers set the owner id per request for RLS (for example with a transaction-local setting).
- The anonymous owner id: generate in the browser, store in `localStorage`, send with requests.
- `POST /api/events`: batch insert. The client batches changes and sends about once per second, downsampled.
- `/dashboard`: charts reading only the continuous aggregate.
- Verify against TigerData's current docs for hypertable and continuous aggregate syntax and policies.

Done when: a pinching session shows up as rows in `param_events`, the dashboard updates from the aggregate, and a second owner id cannot read the first one's rows.

### WP8: Memory (Backboard) and voice (ElevenLabs), later
Branches: `feat/backboard`, `feat/voice` (after WP6; starting around midnight)

- Backboard: store each approved mapping and stated preference per owner; before calling Gemini, retrieve relevant memory and include it. Server side only. Check Backboard's current API docs for the exact calls.
- ElevenLabs: a conversational agent with client tools such as `proposeMapping(intent)` and `applyMapping()`, using a signed URL or token generated by a route handler. The mic button starts and stops the conversation. Spoken confirmations for proposed and applied mappings. Check the current agents SDK docs.

Done when: a spoken request produces a proposed mapping, and a new session recalls an earlier preference.

### WP9: Polish and stretch (morning)
Two-handed control, hand height as a second axis, opt-in semantic notes, Web MIDI bridge to a DAW, error and empty states, demo fallbacks, README and Devpost assets. See `CLAUDE.md` sections 11 and 12 for the cut order.

---

## 5. Who runs what

| Person | Packages |
|---|---|
| Audio lead | WP3, WP4, WP5 |
| UI teammate | WP2, then dashboard UI in WP7 |
| Backend | WP6, ingest route in WP7, WP8 backend parts |
| DevOps | WP7 migrations and RLS, Vercel and CI, secrets, ElevenLabs agent setup |

Suggested parallel setup: one Claude Code session per package, each in its own git worktree and branch, so sessions do not overwrite each other's files. WP1 lands first, because everything imports the contract.

---

## 6. Accounts and secrets checklist (DevOps)

Create these now and share keys through a password manager or the platform's secret store, never in chat or the repo:

- Gemini API key
- ElevenLabs account, API key and a configured agent id
- Backboard.io account and API key
- TigerData service and `DATABASE_URL`
- Vercel project linked to the repo, with environment variables set
- GoDaddy domain (once the name is chosen) with DNS pointed at Vercel

---

## 7. Demo definition of done

The demo is ready when all of this works on the demo laptop, with the real webcam:

1. Open the site, click Start audio, and hear the test sound.
2. Pinch and open the right hand and hear reverb and delay move together, with the UI badges updating.
3. Type "make it dreamier", approve the proposed mapping, and hear a different response from the same pinch.
4. Speak a request and see the same proposal flow.
5. Reload, and the producer's earlier preference is remembered.
6. Open the dashboard and see the session's parameter activity.
7. Unplug the camera or disable the network: the fake pinch and the rack still work.

Keep a recorded backup of this run.

---

## 8. Open items

- Project name and domain
- Package manager and CI tooling (suggested: pnpm, ESLint, Prettier, Zod, Vitest)
- Whether live audio input is a microphone or only a built-in test source
- Which of reverb decay or delay feedback is the main live pinch target (default: wet mix and delay feedback)
- Clerk: decide at the midnight checkpoint
- Devpost track and submission requirements (video, repo link)

---

## 9. Kickoff prompt (paste this into Claude Code at the repo root)

```
Read CLAUDE.md and HANDOFF.md at the repo root completely before doing anything.

Start with step 0 in HANDOFF.md: inspect this repository and report the framework, package manager, folder structure, scripts, CI, and any conflicts with CLAUDE.md. Do not change any files yet. Propose how to adapt the proposed layout to what already exists.

After I confirm, work on WP1 on branch feat/scaffold-contract. Follow all ground rules in section 2 of HANDOFF.md. In particular: do not add Co-Authored-By trailers, "Generated with" lines or session links to any commit or PR text; never push to main; never commit secrets; verify third-party library APIs against their current docs before using them. When finished, summarize what changed, what you tested, and anything left undone.
```
