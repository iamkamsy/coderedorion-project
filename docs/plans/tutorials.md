# Plan: beginner tutorials

Status: tutorial 1 is the demo tutorial and must ship. Tutorials 2 and 3 ship as playable previews (same UI, less polish). The audience change is recorded in CLAUDE.md section 1.

## Audience and promise

Beginner producers who have never really used effect plugins. Each tutorial teaches **one idea** in about 3 minutes, in a playground that loads **only** the effects being taught. The full studio at `/` stays unchanged for free play.

## Where it lives

- `/learn`: three tutorial cards (title, the idea, effects used, minutes, status).
- `/learn/[slug]`: the playground. It reuses the stage, rack and assistant, with:
  - a rack that contains only the tutorial's effects
  - a preset bar
  - a coach pop-up anchored to the control it is talking about, with Back, Next and Skip
  - an assistant that can **answer questions** (explain mode) or **change the sound** (mapping mode, limited to the tutorial's effects)
- The main studio top bar gets one **Learn** link. Nothing else in the studio changes.

Tutorials are data (`src/tutorials/*.ts`, validated with Zod): effects, presets, steps and suggested questions. A step points at an element with `data-tour="<id>"` and can complete itself when a check passes (a parameter crossed a value, A/B was used, a preset was loaded, and so on). Every step can be skipped.

## The three tutorials

| #   | Slug              | Idea                                                                                                                | Effects                    | Presets                           | Status   |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------- | -------- |
| 1   | `echoes-in-time`  | Delay is a copy of your sound arriving later. Feedback is how many copies. Syncing to the beat makes echoes musical | Filter, Delay (tempo sync) | Slapback, Dub echo, Dotted eighth | **Demo** |
| 2   | `grit-and-warmth` | Distortion adds harmonics. More drive means more loudness, which is why the limiter matters. Tone shapes the fizz   | Distortion, Filter         | Warm tape, Crunch, Fuzz           | Preview  |
| 3   | `movement`        | Modulation is an effect that changes over time. Rate is speed, depth is how far                                     | Phaser, Reverb             | Slow swirl, Jet, Wobble           | Preview  |

Tutorial 1 steps:

1. Start audio
2. Hold A/B to hear the dry sound
3. Pinch open to raise feedback (more echoes)
4. Lock the delay to 1/8 dotted
5. Load the Dub echo preset
6. Ask the assistant a question
7. Recap, with a link to tutorial 2

## Isolation: nothing carries over between tutorials

**Audio**

- The rack is built from a module list (`new Rack({ modules })`). Each tutorial visit creates a **new** rack. Leaving it disposes every node, closes the live input stream, cancels pending parameter timers, and stops, clears and resets Tone's Transport, which is a page-wide singleton.
- The playground component is keyed by slug. Moving from one tutorial to another unmounts the old one completely, including its rack, camera and tracker, event batcher and state, before the new one mounts.
- Mappings are limited to the tutorial's effects. `validateMapping(json, { plugins })` rejects anything else, on both client and server, and the Gemini prompt and response schema only list those parameters.

**Data**

- Each visit gets a fresh `session_id`. Every event in its batches carries that id, and a batch never contains events from two sessions.
- Leaving the tutorial flushes and closes its batcher before the next tutorial's batcher exists.
- `tutorial_sessions` records the visit (start, end, completed steps). `ingest_batches` makes uploads idempotent (migration `005_tutorials.sql`).

## Queued upload in a worker (next PR after the pages)

- A dedicated Web Worker owns an outbox stored in IndexedDB. The page posts closed batches (`batch_id`, `session_id`, `tutorial_id`, events) to it.
- The worker sends them to `/api/events` in order, with exponential backoff, and deletes each batch only after a 2xx response. Queued batches survive reloads and dropped wifi.
- `/api/events` inserts the `ingest_batches` row and the events in **one transaction**. A duplicate `batch_id` means the batch was already stored, so it returns 200 and does nothing.
- On tutorial exit the page posts a `session-end` message. The worker sends the `tutorial_sessions` update after that session's last batch.
- A server-side queue (Vercel Queues, public beta) is not needed yet. Revisit only if database writes become the bottleneck.

## Quick wins this depends on

- **Distortion** (`drive`, `mix`) and **Phaser** (`rate`, `depth`, `mix`) modules, clamped like everything else.
- **Bypass per module**: a 30 ms crossfade, so it never clicks. Approving a mapping un-bypasses the modules it targets.
- **A/B (hold for dry)**: a crossfade between the dry input and the processed chain, before the master stop and the limiter.
- **Tempo-synced delay**: divisions 1/4, 1/4 dotted, 1/8, 1/8 dotted, 1/16 at the loop's BPM. The delay time slider shows the division while synced.

## Build order (one branch and PR each)

1. `docs/tutorials-plan`: this plan, the CLAUDE.md audience update, migration 005
2. `feat/rack-modules`: module-based rack, isolation on dispose, plugin allowlist for mappings
3. `feat/quick-wins`: distortion, phaser, bypass, A/B, tempo sync
4. `feat/learn`: `/learn` pages, coach pop-ups, preset bar, explain mode, the three tutorial data files
5. `feat/event-queue`: Web Worker outbox and idempotent `/api/events`

## Open items **[confirm]**

- Phaser (chosen) versus chorus for tutorial 3
- Whether explain-mode answers are logged (they would count as intent text, so opt-in only)
