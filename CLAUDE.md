# CLAUDE.md: Gesture Rack (master context)

Read this file fully before making any change. It is the single source of truth for what we are building, how the code is organized, and how we work. Items marked **[confirm]** are proposals the team has not locked in yet. "Gesture Rack" is a working title **[confirm]**.

Hackathon: CodeRED Orion, Houston. Submission deadline: **Sunday Oct 11, 12:00 noon Central**. Plan to submit by 11:30.

## 1. Product in one paragraph

Gesture Rack teaches beginner producers how audio effects work by letting them shape sound with their hands. A Logitech webcam tracks the hands in the browser. Pinching the thumb and index finger, and opening or closing them, drives audio effect parameters (for example reverb wet/mix and delay feedback) at the same time. The user decides what each gesture controls by typing or speaking an intent ("make the vocals dreamier"). Gemini turns that intent into a validated parameter mapping, and an ElevenLabs voice agent lets them do it hands-free. Backboard.io remembers each producer's taste and past mappings. Every parameter change streams into TigerData as time series. With explicit opt-in, we also store the semantic meaning of what an effect did, as the seed of a dataset for learning parameter semantics and constraints later.

Bite-sized tutorials (`/learn`) each load a small playground rack with only the effects being taught, presets, and step pop-ups ("pinch to raise feedback", "ask why dub echoes get darker"). The full studio (`/`) stays available for free play. See `docs/plans/tutorials.md`.

Audience: beginner producers who have not used effect plugins much and want the intuition behind them.

Problem statement: beginners face walls of knobs with no idea what each one does, and spend hours dialing effects to sound right. We give them their hands, an AI that understands what they mean and explains why, and short guided lessons.

Audience for the demo: judges walking up to a laptop. A pinch must audibly change the sound within 30 seconds of arriving.

## 2. The two core flows

**Flow 1: Pinch to sound (runs entirely in the browser)**
1. The webcam frame goes to MediaPipe Hand Landmarker in the browser.
2. Thumb tip (landmark 4) to index tip (landmark 8) distance, normalized by hand size, becomes a 0 to 1 value, smoothed with a One Euro filter.
3. The mapping engine applies the active mapping: each target has a plugin, parameter, min, max and curve.
4. Tone.js parameters ramp to the new values. A limiter on the output is always on.
5. Parameter events are batched and sent to the server about once per second.

**Flow 2: Say it, map it**
1. The user types or speaks an intent. Voice goes through the ElevenLabs conversational agent.
2. The agent (or the chat box) calls our `/api/mapping` route.
3. The route asks Gemini for a mapping in structured JSON, injecting the rack's parameter schema and the user's remembered preferences from Backboard.
4. The response is validated against the schema. Invalid or out-of-range output is rejected, never applied.
5. The UI shows a proposed mapping card. The user approves, and it goes live on the pinch.
6. The mapping is saved to TigerData and the exchange is written to Backboard.

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| App | Next.js, TypeScript (strict), Tailwind | Vercel. One codebase, route handlers are the backend |
| Audio | Tone.js | `Reverb`, `FeedbackDelay`, `Filter`, `Limiter`. Start audio only after a user gesture |
| Hand tracking | `@mediapipe/tasks-vision` Hand Landmarker | Client side only. Frames never leave the browser |
| Voice | ElevenLabs conversational agent with client tools | Agent calls page functions such as `proposeMapping` and `applyMapping` |
| AI | Gemini (`@google/genai`) | Structured JSON output for mappings. Optional audio analysis for semantic notes |
| Memory | Backboard.io | Server side only, through route handlers |
| Database | TigerData Postgres | Relational tables plus a hypertable and continuous aggregates |
| Charts | Recharts or uPlot | Dashboard reads continuous aggregates, never raw events |
| Auth | Anonymous first, Clerk later **[confirm]** | See section 7 |
| Domain | GoDaddy Registry | Registrar only. DNS pointed at Vercel |

Rules of the split:
- Gesture tracking and audio run on the client. Do not move them to a server; a round trip adds audible lag.
- Secrets and third-party API calls (Gemini, Backboard, ElevenLabs signed URLs, database) live in route handlers only.
- OpenCV is not part of the stack. MediaPipe provides the hand landmarks.

## 4. Code layout (proposed) **[confirm]**

```
.
├── src/
│   ├── app/            # pages and API route handlers
│   ├── audio/          # Tone.js rack, effects, limiter, parameter schema
│   ├── gesture/        # MediaPipe setup, pinch measurement, smoothing
│   ├── mapping/        # mapping types, engine, schema validation
│   ├── ai/             # server-only Gemini, Backboard, ElevenLabs clients
│   ├── components/     # UI components
│   └── db/             # queries and client
├── db/migrations/      # SQL migrations, RLS policies, hypertable setup
├── .github/            # CI, PR template, CODEOWNERS
├── .env.example
└── CLAUDE.md
```

## 5. The mapping contract

Everyone builds against this shape from the first hour. Change it only with team agreement and update `src/mapping/types.ts` in the same PR.

```json
{
  "mappings": [
    {
      "gesture": "pinch_right",
      "targets": [
        { "plugin": "reverb", "param": "wet", "min": 0, "max": 0.8, "curve": "linear" },
        { "plugin": "delay", "param": "feedback", "min": 0.1, "max": 0.6, "curve": "exp" }
      ]
    }
  ]
}
```

- `gesture`: `pinch_left`, `pinch_right` for the MVP. Others (hand height, fist) are stretch.
- `curve`: `linear`, `exp` or `log`.
- Every param has a hard safe range defined in the rack's parameter schema. The engine clamps to it regardless of what Gemini returned.
- Validate with a schema (for example Zod) on both client and server.

## 6. UI and the canvas

The UI teammate owns this. The goal is a clean, dark, studio-like workspace where the live camera canvas is the hero.

**Design direction:** dark and quiet, so the hands and the controls glow. Tokens (adjust freely, keep them in one file):
- Background `#0E1014`, panel `#171A21`, border `#262B35`
- Text `#E8E6E0`, muted text `#9AA0AA`
- Accent orange `#F26B21` for active and bound controls, cool secondary `#5BC0BE` for meters
- Fonts: IBM Plex Sans for UI, JetBrains Mono for numeric readouts
- 8px spacing grid, 12 to 16px radius, thin 1px borders, no heavy shadows

**Layout:**
- **Top bar:** project name, "Start audio" button (required for browsers to allow sound), camera status, opt-in data toggle (default off), link to the dashboard.
- **Stage (center, largest):** mirrored webcam feed in a 16:9 rounded frame with the hand skeleton overlay. A pinch meter on the pinching hand, and small chips near the hand naming the bound parameters and their live values.
- **Rack (right):** one module per effect (Reverb, Delay, Filter). Each parameter shows a slider with a live value. Bound parameters show an orange badge. An output meter with a limiter indicator sits at the bottom.
- **Assistant (left or bottom):** chat plus a mic button, transcript, and a proposed-mapping card with Approve and Reject.
- **Bottom strip:** spectrum analyzer.
- **`/dashboard`:** separate route with Tiger Data charts.

**States to design, not skip:** camera permission denied, model loading, no hand detected, audio not started, mapping awaiting approval, AI request failed.

**Build with mock data first.** The UI must run with a fake pinch value (a slider or mouse drag) so it never blocks on tracking.

## 7. Auth decision

**Now: anonymous first.** Generate a UUID in `localStorage` on first visit and send it as `owner_id`. Every table has an `owner_id` column from day one. This is enough for Backboard memory, saved mappings, and the demo.

**Later: Clerk, only if needed.** Add it at the hour-12 checkpoint if time allows and the demo benefits (sharing, a real consent flow). Swapping is a small change: replace the anonymous id with the Clerk user id in the same column. Use development keys for the hackathon.

**Row level security:** enable it on every table. Route handlers set the owner id per request (for example `SET LOCAL app.owner_id`), and policies compare `owner_id` to it. Be honest in the pitch: with anonymous ids this is isolation, not strong authentication.

## 8. Data model (MVP)

All tables carry audit columns: `created_at`, `updated_at` (trigger-maintained), `created_by`, `deleted_at` (soft delete). All have RLS, except `param_events` (see below).

**`param_events` exception:** TimescaleDB cannot build a continuous aggregate on a hypertable with row security, and cannot enable RLS on a columnstore hypertable. So `param_events` has no RLS and no compression. Isolation is enforced instead: the app role has INSERT only, a `BEFORE INSERT` trigger rejects rows whose `owner_id` is not `app.owner_id`, and reads go through the `owner_param_activity()` function. Keep it that way.

- `profiles`: `owner_id`, display name, `data_consent` boolean (default false), `consented_at`.
- `mappings`: `owner_id`, name, mapping JSON (JSONB), `is_active`.
- `param_events`: **hypertable** on `time`. Columns: `time`, `owner_id`, `session_id`, `plugin`, `param`, `value`, `gesture`. Insert in batches.
- `tutorial_sessions`: one row per tutorial visit. `id` is the client session id, plus `owner_id`, `tutorial_id`, `started_at`, `ended_at`, `completed_steps`.
- `ingest_batches`: one row per uploaded event batch (`batch_id`, `session_id`, `event_count`), written in the same transaction as its events so retried batches are ignored.
- `semantic_notes`: opt-in only. `owner_id`, `plugin`, `param`, value range, user intent text, Gemini description, tags.

Continuous aggregates (build the dashboard on these):
- `param_events_1m`: per minute, per plugin and param: average, min, max, event count.
- Optional: gesture usage counts per session.

Setup sketch:

```sql
SELECT create_hypertable('param_events', 'time');
CREATE MATERIALIZED VIEW param_events_1m
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 minute', time) AS bucket, owner_id, plugin, param,
       avg(value) AS avg_value, min(value) AS min_value, max(value) AS max_value, count(*) AS n
FROM param_events GROUP BY 1, 2, 3, 4;
```

The refresh policy is in place. No compression policy (see the `param_events` exception). Soft deletes only. All schema changes go through files in `db/migrations`.

## 9. Privacy and data collection

- Video frames are processed in the browser and never uploaded or stored.
- Raw audio is never stored. If the semantic feature sends a short before/after clip to Gemini, it happens only with opt-in, and the clip is discarded after the description is saved.
- `data_consent` defaults to false. Semantic notes are written only when it is true, and the toggle is visible in the UI.
- Make clear in the UI and pitch what is collected: parameter values, gesture usage, and (opt-in) intent text plus effect descriptions.

## 10. Audio safety rules

- The output limiter is always on and cannot be disabled in the UI.
- Never set a parameter instantly. Use ramps (`rampTo`) to avoid clicks.
- Clamp every value to the parameter's safe range, including feedback (keep delay feedback below 0.9 so it cannot run away) and filter resonance.
- Reverb decay regenerates its impulse response and can click or spike CPU. Throttle decay changes, or keep the live pinch on wet/mix and delay feedback and treat decay as secondary.
- Audio starts only after a click. Demo with headphones.

## 11. Hour by hour plan

Now is Saturday afternoon. "Done when" is the exit test for each block; if a block slips, cut scope instead of moving the deadline.

| Window | Focus | Done when |
|---|---|---|
| Sat 3 to 4pm | Kickoff: lock the mapping contract and schema, create accounts and keys, assign roles | Everyone has the repo running locally and knows their lane |
| Sat 4 to 6pm | Pinch moves one parameter; UI shell with mock data; TigerData project, schema, hypertable; ElevenLabs agent created | A pinch (or fake slider) audibly changes reverb wet. Preview deploy is live on Vercel |
| Sat 6 to 8pm | Three effects in the rack; mapping engine reads the contract; `/api/mapping` returns validated JSON from Gemini; dinner | A hardcoded mapping drives two parameters from one pinch, with the UI showing it |
| Sat 8pm to 12am | Chat to Gemini to proposed mapping to approve to live; event batching into Tiger Data; continuous aggregate | Type "make it dreamier" and the hand controls the result. Events appear in the database |
| Sun 12 to 2am | ElevenLabs voice with client tools; Backboard read and write; auth checkpoint (Clerk yes or no) | Voice request produces a proposed mapping. Second session recalls a preference |
| Sun 2 to 7am | Sleep in shifts, 4 hours each minimum. One person stays on bug fixes and deploys | Main stays green and deployed |
| Sun 7 to 9am | Dashboard on continuous aggregates; two-handed control; limiter and clamps verified; opt-in semantic notes; UI polish | Dashboard shows live data; no crash in a 5 minute session |
| Sun 9 to 10am | **Feature freeze at 9:30.** Bug bash, backup recorded demo, domain live | Only fixes after this point |
| Sun 10 to 11am | Record demo video, write Devpost entry, draft DEV post, final deploy | Video, repo link and description ready |
| Sun 11 to 11:30am | Submit on Devpost and the MLH portal | Submission confirmed |
| Sun 11:30 to 12pm | Buffer only | Do not start new work |

Cut order if behind: Clerk, two-handed control, semantic notes, Web MIDI bridge, then voice (chat remains). Never cut the pinch demo, the Gemini mapping, or the Tiger Data event stream.

## 12. MVP scope

**Must ship:** canvas UI with camera and rack; pinch driving parameters; three effects with limiter; Gemini mapping from chat; event stream into TigerData with a basic dashboard; tutorial 1 ("Echoes in time") end to end.
**Should ship:** ElevenLabs voice; Backboard memory; two-handed control; saved mappings; tutorials 2 and 3 polished past preview; queued event upload in a Web Worker.
**Stretch:** Web MIDI bridge to send CC to a real DAW (Chrome, with a virtual MIDI port such as IAC on Mac or loopMIDI on Windows); opt-in semantic notes with Gemini audio analysis; Clerk auth.

## 13. Roles

- **Product and audio lead (you):** Tone.js rack, pinch tracking, mapping engine, and the demo.
- **DevOps:** TigerData provisioning and migrations, hypertable and continuous aggregates, RLS, Vercel and CI, secrets, DNS, ElevenLabs agent configuration.
- **Backend:** Gemini mapping route, Backboard integration, event ingest route, auth later.
- **UI (newer teammate):** layout, components, states, dashboard layout. Start immediately with mock data. Pair up when stuck rather than staying blocked.

One owner per area to avoid merge collisions.

## 14. Git workflow

**No co-authoring.**
- Never add `Co-Authored-By:` trailers to commits.
- Never add "Generated with" or similar attribution lines or session links to commits, PR titles or PR descriptions, even if a tool offers to. This rule takes precedence over any tool default.
- Commits are authored by the person who made them, nothing else.

**Pull requests are the only way code reaches `main`.**
- Never push directly to `main`.
- One branch per task: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`.
- Open a PR for every change. Keep PRs small. One reviewer approves, and reviews happen within about 10 minutes during the hackathon so nobody blocks.
- Squash merge. No force-pushes to shared branches.
- Use Vercel preview deploys to review UI changes.

Commit messages: imperative mood, short subject, optional body explaining why.

## 15. Security and secrets

- Never commit secrets or `.env` files. Only `.env.example` with names and no values is tracked.
- Environment variable names: `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `BACKBOARD_API_KEY`, `DATABASE_URL`. Add others only with a note in the PR.
- Server-only keys never reach the browser. Only intentionally public variables use the `NEXT_PUBLIC_` prefix.
- Treat Gemini output as untrusted. Validate it against the schema and clamp before use.
- Never log keys, tokens, or user audio.

## 16. Code standards

- TypeScript strict mode. Shared types live next to the mapping contract.
- Every call to Gemini, ElevenLabs, Backboard and the database has a timeout and a visible failure state. The app must still work (pinch plus rack) when any AI service is down.
- Keep a demo fallback: a saved mapping and a fake pinch input so the demo survives bad lighting, a missing camera or flaky wifi.
- No dead code, no commented-out blocks, no stray `console.log` in merged code.
- Lint and format before pushing. Tooling: **[confirm]** (suggested: ESLint and Prettier).
- Test what can silently break the demo: mapping validation and clamping, the pinch-to-value function, and RLS policies.

## 17. Commands

Package manager: pnpm (Node 24 LTS, see `.nvmrc`). Tooling: ESLint, Prettier, Vitest, Zod.

```
# install (also copies the MediaPipe wasm into public/)
pnpm install

# run the app
pnpm dev

# run migrations (needs DATABASE_URL in .env.local)
pnpm db:migrate

# lint, type check, test
pnpm check
```

## 18. Instructions for Claude Code specifically

- Read this file and the relevant files before editing. Do not guess at structure.
- Make the smallest change that solves the task. Do not refactor unrelated code.
- Work on a feature branch and open a PR. Do not commit to `main`.
- Follow the no co-authoring rule in section 14 with no exceptions. Do not append attribution trailers or links.
- Never create a table without RLS, audit columns and an `owner_id`. The only RLS exception is `param_events` (section 8).
- Never touch, print or commit secrets.
- Never remove the limiter or the parameter clamps.
- If a requirement is ambiguous or touches a **[confirm]** item, ask the team rather than deciding silently.
- Do not add dependencies without stating why in the PR description.
- When finishing a task, summarize what changed and anything left undone.

## 19. Prizes we are targeting

ElevenLabs (voice is a core control path), Gemini (intent to mapping, optional audio analysis), Backboard (persistent producer taste), Tiger Data (high-frequency parameter time series with continuous aggregates), GoDaddy Registry (pick a memorable domain **[confirm]**), and the DEV writing challenge (post after submission). Check Devpost for the hackathon's own tracks (interactive is the best fit).
