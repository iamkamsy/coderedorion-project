# Voice agent setup ("Hey Gesture Labs")

The page listens for "Hey Gesture Labs", pauses the rack, and opens a voice conversation with our ElevenLabs agent. The agent changes the sound by calling tools on the page. Configure it once in the ElevenLabs dashboard (Agents, then our agent).

## Agent tab

- **First message:** `I'm here.`
- **LLM:** a fast Gemini Flash model. The agent's own LLM answers questions, so it does not use our Gemini API key.
- **Voice:** any voice. The lesson coach (`/api/speak`) speaks in this same voice.
- **System prompt:**

```
You are Gesture Labs, a voice control for a music producer's effects rack. They shape sound by pinching their fingers in front of a webcam.
The page tells you the effects and whether each is on, the parameter ids, what each pinch drives, and what is locked.

Be terse. Say only what you are doing or what happened, in a few words. No greetings, small talk, pleasantries, sign-offs, or "anything else?" questions.

Turn an effect on or off ("turn off the phaser"): call setEffect with its id. Never propose a mapping for this.
Change what a pinch controls or how the sound responds: say "Thinking of those changes." then call proposeMapping with the request in their words. Read the proposal back in one short sentence and ask "Apply it?". On yes call applyMapping, on no call rejectMapping.
Lock or unlock settings so the pinch stops or starts moving them: call lockParams with pinch_right or pinch_left for a whole hand, all for everything, or parameter ids for single settings (for example "phaser.frequency" for Phaser Rate). Locked settings keep their current value.
Pause or resume the music: call setAudio. When they say resume, or that they are done, call setAudio with playing true, then end the conversation.
Answer questions about sound in one or two plain sentences. If a question is not about sound or this app, say you only help with the session.
```

## Tools (Client tools, all with "Wait for response" on)

| Name             | Description                                                           | Parameters                                                                                                                 |
| ---------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `proposeMapping` | Ask for a new pinch mapping that matches what the user wants to hear. | `intent` (string, required): the user's request in their words                                                             |
| `applyMapping`   | Apply the mapping that was just proposed.                             | none                                                                                                                       |
| `rejectMapping`  | Discard the proposed mapping.                                         | none                                                                                                                       |
| `setEffect`      | Turn one effect on or off.                                            | `effect` (string, required): effect id; `on` (boolean, required)                                                           |
| `lockParams`     | Lock or unlock settings so the pinch stops or starts moving them.     | `targets` (string, required): comma-separated pinch_right, pinch_left, all, or parameter ids; `locked` (boolean, required) |
| `setAudio`       | Pause or resume the music.                                            | `playing` (boolean, required): true to resume, false to pause                                                              |

On `proposeMapping`, set **Pre-tool speech** to **Force**, so the agent speaks while the mapping is worked out.

Also turn on the **End conversation** system tool.

## Security tab

- Turn on **authentication**. The page gets a short-lived signed URL from `/api/voice` (WebSocket connection), so the API key never reaches the browser.
- Add the site domain and `localhost:3000` to the allowlist.

## Environment

`ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` (exact names) in `.env.local` and in Vercel. The key needs the Text to Speech and Agents permissions.
