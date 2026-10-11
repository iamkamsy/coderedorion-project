"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { ConversationProvider, useConversation, useConversationClientTool } from "@elevenlabs/react";
import { isEffectId, rackPlugins, type EffectId } from "@/audio/rackSpec";
import { PLUGINS, getParamSpec, specsForPlugin } from "@/audio/paramSchema";
import { resolveParamRefs } from "@/mapping/engine";
import type { Mapping } from "@/mapping/types";
import { useSpeaking } from "@/lib/speech";
import { listenForWakeWord, wakeWordSupported } from "@/lib/wakeWord";
import { aiErrorText, requestMapping, type Proposal } from "./Assistant";
import { THINKING_PHRASES, ThinkingIndicator } from "./ThinkingIndicator";

interface Props {
  modules: readonly EffectId[];
  /** What the pinch drives right now; shared with the agent so it can answer questions about it. */
  summary: string;
  /** Audio has been started; the assistant listens for its wake phrase from then on. */
  audioOn: boolean;
  /** The rack is running and not stopped, so there is sound to pause while we talk. */
  playing: boolean;
  onSetStopped: (stopped: boolean) => void;
  onApprove: (proposal: Proposal) => void;
  /** The mapping waiting for a yes or no. Shown over the camera by the studio. */
  proposal: Proposal | null;
  onProposal: (proposal: Proposal | null) => void;
  mapping: Mapping;
  bypassed: ReadonlySet<EffectId>;
  locked: ReadonlySet<string>;
  onSetEffect: (effect: EffectId, on: boolean) => void;
  onLock: (keys: readonly string[], locked: boolean) => void;
}

const pluginLabel = (id: string) => PLUGINS.find((p) => p.id === id)?.label ?? id;

/** "phaser.frequency" -> "Phaser Rate", the name the producer sees on screen. */
function paramName(key: string): string {
  const [plugin, param] = key.split(".");
  return `${pluginLabel(plugin)} ${getParamSpec(plugin, param)?.label ?? param}`;
}

/** What the agent needs to act on the rack: effects and their state, param ids, what each pinch drives, and locks. */
function rackContext(modules: readonly EffectId[], bypassed: ReadonlySet<EffectId>, mapping: Mapping, locked: ReadonlySet<string>): string {
  const effects = modules.map((m) => `${m} (${bypassed.has(m) ? "off" : "on"})`).join(", ");
  const params = rackPlugins(modules)
    .flatMap((p) => specsForPlugin(p).map((s) => `${s.plugin}.${s.param} = ${paramName(`${s.plugin}.${s.param}`)}`))
    .join("; ");
  const hands = mapping.mappings.map((m) => `${m.gesture} drives ${m.targets.map((t) => `${t.plugin}.${t.param}`).join(", ")}`).join(". ");
  return `Effects (id and state): ${effects}. Parameter ids: ${params}. ${hands}. Locked: ${[...locked].join(", ") || "none"}. The audio is paused while you talk.`;
}

/**
 * "Hey Gesture Labs": the browser listens for the phrase, the rack pauses, and an ElevenLabs agent
 * takes the request by voice. It proposes and applies mappings through the same Gemini route as the
 * chat, and can pause or resume the audio. Sound comes back when the talk ends unless the user paused it.
 */
export function VoiceAgent(props: Props) {
  return (
    <ConversationProvider>
      <VoicePanel {...props} />
    </ConversationProvider>
  );
}

const noSubscribe = () => () => {};

function VoicePanel(props: Props) {
  const {
    modules,
    summary,
    audioOn,
    playing,
    onSetStopped,
    onApprove,
    proposal,
    onProposal,
    mapping,
    bypassed,
    locked,
    onSetEffect,
    onLock,
  } = props;
  // The server cannot know the browser's speech support; report "no" there so hydration matches.
  const canWake = useSyncExternalStore(noSubscribe, wakeWordSupported, () => false);
  /** Mic permission was refused, so stop trying to listen. */
  const [blocked, setBlocked] = useState(false);
  // Not while the lesson or tour coach is talking: its lines can say the wake phrase out loud.
  const coachSpeaking = useSpeaking();
  const armed = audioOn && canWake && !blocked && !coachSpeaking;
  const [thinking, setThinking] = useState(false);
  /** Bumped to start the wake listener again after a conversation or a failed connect. */
  const [listenKey, setListenKey] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Whether the rack should play once the conversation ends. */
  const resumeAfterRef = useRef(false);

  const conversation = useConversation({
    onConnect: () => {
      setConnecting(false);
      conversation.sendContextualUpdate(`Right now the pinch does this: ${summary}. ${rackContext(modules, bypassed, mapping, locked)}`);
    },
    onDisconnect: () => {
      setConnecting(false);
      onSetStopped(!resumeAfterRef.current);
      setListenKey((k) => k + 1);
    },
    onError: () => setError("The voice assistant hit a problem. Try again."),
  });
  const { status, isSpeaking } = conversation;
  const live = status === "connected" || status === "connecting" || connecting;

  useConversationClientTool("proposeMapping", async (params: { intent?: unknown }) => {
    if (typeof params.intent !== "string" || !params.intent.trim()) return "Ask the user what they want to hear.";
    setThinking(true);
    try {
      const p = await requestMapping(params.intent, modules);
      onProposal(p);
      return `Proposed: ${p.summary} It is on screen. Ask the user if they want to apply it.`;
    } catch (err) {
      return `No mapping: ${aiErrorText(err)} The current mapping is still live.`;
    } finally {
      setThinking(false);
    }
  });
  useConversationClientTool("applyMapping", () => {
    if (!proposal) return "There is no proposed mapping. Ask what they want to hear first.";
    onApprove(proposal);
    onProposal(null);
    const hands = proposal.mapping.mappings.map((m) => `${m.gesture} drives ${m.targets.map((t) => `${t.plugin}.${t.param}`).join(", ")}`);
    return `Applied. ${hands.join(". ")}.`;
  });
  useConversationClientTool("rejectMapping", () => {
    onProposal(null);
    return "Discarded. The current mapping stays live.";
  });
  useConversationClientTool("setEffect", (params: { effect?: unknown; on?: unknown }) => {
    const id = typeof params.effect === "string" ? params.effect.trim().toLowerCase() : "";
    if (!isEffectId(id) || !modules.includes(id)) return `No such effect here. Effects: ${modules.join(", ")}.`;
    const on = params.on === true;
    onSetEffect(id, on);
    return `${pluginLabel(id)} ${on ? "on" : "off"}.`;
  });
  useConversationClientTool("lockParams", (params: { targets?: unknown; locked?: unknown }) => {
    const { keys, unknown } = resolveParamRefs(typeof params.targets === "string" ? params.targets : "", mapping);
    const on = params.locked !== false;
    if (keys.length > 0) onLock(keys, on);
    const done = keys.length > 0 ? `${on ? "Locked" : "Unlocked"}: ${keys.map(paramName).join(", ")}.` : "Nothing matched.";
    return unknown.length > 0 ? `${done} Unknown: ${unknown.join(", ")}.` : done;
  });
  useConversationClientTool("setAudio", (params: { playing?: unknown }) => {
    resumeAfterRef.current = params.playing === true;
    onSetStopped(!resumeAfterRef.current);
    return resumeAfterRef.current ? "The audio is playing." : "The audio is paused.";
  });

  const begin = async () => {
    setError(null);
    setConnecting(true);
    resumeAfterRef.current = playing;
    onSetStopped(true);
    try {
      const res = await fetch("/api/voice", { signal: AbortSignal.timeout(8000) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.signedUrl !== "string") throw new Error(data.error ?? "The voice assistant is unavailable right now.");
      conversation.startSession({ signedUrl: data.signedUrl, connectionType: "websocket" });
    } catch (err) {
      setConnecting(false);
      onSetStopped(!resumeAfterRef.current);
      setError(err instanceof Error && err.name === "TimeoutError" ? "The voice assistant took too long to connect." : aiErrorText(err));
      setListenKey((k) => k + 1);
    }
  };

  const onWake = useEffectEvent(() => void begin());
  useEffect(() => {
    if (!armed || live) return;
    return listenForWakeWord(onWake, () => {
      setBlocked(true);
      setError("Microphone access is needed to hear “Hey Gesture Labs”. Allow it in the browser's site settings.");
    });
  }, [armed, live, listenKey]);

  const state = live
    ? status !== "connected"
      ? "Connecting..."
      : isSpeaking
        ? "Speaking"
        : "Listening, say what you want"
    : armed
      ? "Say “Hey Gesture Labs”"
      : !canWake
        ? "Voice needs Chrome or Edge"
        : audioOn
          ? "Voice is off"
          : "Start audio, then say “Hey Gesture Labs”";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-inset p-2.5">
      <div className="flex items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${live ? "bg-accent shadow-[0_0_8px_var(--accent)]" : armed ? "bg-cool" : "bg-border"}`}
          aria-hidden
        />
        <p className="min-w-0 flex-1 truncate text-[13px]" role="status">
          {state}
        </p>
        {live && (
          <button
            type="button"
            onClick={() => conversation.endSession()}
            className="rounded-lg border border-border px-2.5 py-1 text-[12px]"
          >
            End
          </button>
        )}
      </div>
      {thinking && <ThinkingIndicator phrases={THINKING_PHRASES.map} />}
      {error && (
        <p className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
