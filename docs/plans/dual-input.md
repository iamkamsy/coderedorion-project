# Plan: two audio inputs (voice commands + instrument)

Status: proposal. Items marked **[confirm]** need team agreement.

## Goal

Demo with a guitar plugged in. The guitar runs through the rack. The performer controls it with one free hand (pinch for parameters, a gesture to stop) and with their voice ("stop audio", "switch to the dreamy preset"), without the voice and the guitar bleeding into each other.

## Two lanes, never mixed

|                               | Command lane                                              | Instrument lane                                          |
| ----------------------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| Input device                  | USB headset mic, close to the mouth                       | Audio interface input (guitar DI)                        |
| Browser processing            | Noise suppression, echo cancellation and auto gain **on** | All **off**: raw signal, so the tone and sustain survive |
| Goes to                       | ElevenLabs conversational agent only                      | The rack: low cut, gate, effects, limiter, output        |
| Ever routed into the effects? | **No**                                                    | Yes                                                      |
| Owner                         | Backend (agent, token route) + DevOps (agent config)      | Audio lead                                               |

Why two devices: the ElevenLabs SDK opens its own microphone stream. If it shared the guitar input, the agent would hear the guitar, and the rack would hear speech. The SDK accepts an `inputDeviceId` (verified in `@elevenlabs/client` 1.27.0: `InputConfig.inputDeviceId`, `changeInputDevice()`), so each lane can pin its own device.

```
Headset mic ──(suppression on)──> ElevenLabs agent ──client tools──> stopAudio / startAudio / applyPreset / proposeMapping
                                                                          │
Guitar ─> interface ─(raw)─> Low cut ─> Gate ─> Filter ─> Delay ─> Reverb ─> Master mute ─> Limiter ─> headphones
                                                   ▲
Webcam ─> MediaPipe ─> pinch ─> mapping engine ────┘      fist hold ─> Master mute toggle
```

## What already exists (PR `feat/mic-gate`)

- Sources `loop`, `mic` (vocal: speech processing on, 100 Hz low cut) and `line` (instrument: processing off, 40 Hz low cut, so the guitar's low E at 82 Hz passes).
- Input low cut and noise gate on live input, with a gate open/closed light. Both are clamped and cannot be bound to gestures or by Gemini.

## Work packages

### P1. Device picker and master mute (audio lead, about 1 hour)

- After mic permission, list inputs with `navigator.mediaDevices.enumerateDevices()`. Add a picker for the instrument lane and one for the command lane. Store the chosen ids in `localStorage`.
- Pass `deviceId: { exact: id }` in the rack's `getUserMedia` constraints (`src/audio/inputs.ts`).
- Add a `master` gain between the reverb and the limiter. `stop()` and `start()` ramp it over about 50 ms; never jump. The limiter stays last and always on.
- Expose `Rack.setMuted(boolean)` for gestures and voice to share.

### P2. Voice agent with client tools (backend + DevOps, about 1.5 hours, after P1)

- `GET /api/voice/token`: server-side, returns a conversation token or signed URL for `ELEVENLABS_AGENT_ID`, using `ELEVENLABS_API_KEY`. Check the current SDK docs for the exact call before building.
- Client: start the conversation with `inputDeviceId` set to the **command lane** device.
- Client tools the agent can call:
  - `stopAudio()`, `startAudio()`: call `Rack.setMuted`
  - `applyPreset(name)`: load a saved mapping by name
  - `proposeMapping(intent)`: the same flow as the chat box (validate, then show the card)
  - `approveMapping()`, `rejectMapping()`
- Agent replies play in headphones only, so the instrument lane never picks them up.
- The mic button in the Assistant panel starts and stops the conversation and shows its state.

### P3. Stop gesture (audio lead, about 45 minutes)

- **[confirm]** A closed fist held for 400 ms toggles master mute. Detect it from landmarks: all four fingertips close to the palm center relative to hand size. Debounce it, and show a "Muted" overlay on the stage.
- This is an action gesture, not part of the mapping contract. `pinch_left` and `pinch_right` stay unchanged.

### P4. Stretch: several live lanes at once

- Turn the single live input into `InputLane[]`, each with its own device, constraints, low cut and gate, summed into the rack. That allows guitar plus a performance vocal mic at the same time.

## Demo hardware **[confirm]**

- USB audio interface for the guitar (any class-compliant 2-in interface)
- USB or wired headset mic for voice commands
- **Wired** headphones. Bluetooth adds 150 ms or more of latency.

## Risks

- **Latency.** Browser round-trip through an interface is typically 20 to 40 ms, and guitarists notice more than about 15 ms. Keep reverb and delay as the featured effects, since added latency matters less on those. Test on the demo laptop early.
- **Agent hearing the music.** Mitigated by a close headset mic with suppression on. If it still triggers falsely, add push-to-talk: hold the mic button, or arm it with a gesture **[confirm]**.
- **Same device opened twice with different processing** is unreliable in Chrome. Require two different devices, and show a warning if both pickers select the same one.

## Cut order fit

Following CLAUDE.md section 11: if behind, cut P4, then P3. P2 (voice) is cut before chat; the chat box and the rack keep working without it.
