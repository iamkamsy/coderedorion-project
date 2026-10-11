"use client";

import { useEffect, useRef, useState } from "react";
import { getParamSpec, specsForPlugin, PLUGINS } from "@/audio/paramSchema";
import type { EffectId } from "@/audio/rackSpec";
import { isTargetBound } from "@/mapping/engine";
import { GESTURES, type Gesture, type Mapping } from "@/mapping/types";
import { validateMapping } from "@/mapping/validate";
import { GESTURE_LABEL, formatParam } from "@/lib/format";
import { ownerHeaders } from "@/lib/ownerId";
import { MAX_RECORDING_MS, startRecording, type Recording } from "@/lib/recorder";
import { Collapsible } from "./Collapsible";

export interface Proposal {
  mapping: Mapping;
  summary: string;
  intent: string;
}

interface Message {
  role: "user" | "assistant" | "error";
  text: string;
}

const STUDIO_TRIES = ["Make it dreamier", "Darker and tighter", "Huge slapback echo", "Wide open space"];

type Mode = "ask" | "map";

interface Props {
  modules: readonly EffectId[];
  activeSummary: string;
  onApprove: (proposal: Proposal) => void;
  onResetDefault: () => void;
  mapping: Mapping;
  onToggleParam: (gesture: Gesture, plugin: string, param: string) => void;
  /** In a lesson: questions to suggest, and the lesson the answers are about. */
  lesson?: { slug: string; asks: readonly string[]; tries: readonly string[] };
  onAsked?: () => void;
}

export function Assistant({ modules, activeSummary, onApprove, onResetDefault, mapping, onToggleParam, lesson, onAsked }: Props) {
  // The studio only changes the sound; a lesson starts on questions.
  const [mode, setMode] = useState<Mode>(lesson ? "ask" : "map");
  // Inset boxes: the assistant always sits inside its own glass panel.
  const box = "rounded-xl border border-border bg-inset";
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState<"idle" | "recording" | "transcribing">("idle");
  const recordingRef = useRef<Recording | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leaving the page mid-recording releases the mic and drops the clip.
  useEffect(
    () => () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      recordingRef.current?.cancel();
    },
    [],
  );
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const ask = async (question: string) => {
    setMessages((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: ownerHeaders(),
        body: JSON.stringify({ question, tutorial: lesson?.slug }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The AI could not answer right now.");
      setMessages((m) => [...m, { role: "assistant", text: String(data.answer) }]);
      onAsked?.();
    } catch (err) {
      const msg = err instanceof Error && err.name !== "TimeoutError" ? err.message : "The AI took too long.";
      setMessages((m) => [...m, { role: "error", text: `${msg} The lesson keeps working without it.` }]);
    } finally {
      setLoading(false);
    }
  };

  const finishRecording = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    setVoice("transcribing");
    try {
      const audio = await rec.stop();
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: ownerHeaders(),
        body: JSON.stringify({ audio, mimeType: "audio/wav" }),
        signal: AbortSignal.timeout(35000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not understand the recording.");
      setVoice("idle");
      await submit(String(data.text));
    } catch (err) {
      setVoice("idle");
      const msg = err instanceof Error && err.name !== "TimeoutError" ? err.message : "The AI took too long.";
      setMessages((m) => [...m, { role: "error", text: msg }]);
    }
  };

  const toggleRecording = async () => {
    if (voice === "recording") return finishRecording();
    if (voice !== "idle" || loading) return;
    try {
      recordingRef.current = await startRecording();
      setVoice("recording");
      autoStopRef.current = setTimeout(() => void finishRecording(), MAX_RECORDING_MS);
    } catch {
      setMessages((m) => [...m, { role: "error", text: "Microphone access is needed to talk to the assistant." }]);
    }
  };

  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;
    setInput("");
    if (mode === "ask") return ask(text);
    setProposal(null);
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await fetch("/api/mapping", {
        method: "POST",
        headers: ownerHeaders(),
        body: JSON.stringify({ intent: text, modules }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The AI request failed.");
      const valid = validateMapping(data.mapping, { plugins: modules });
      if (!valid.ok) throw new Error("The AI returned a mapping we could not use.");
      setProposal({ mapping: valid.mapping, summary: String(data.summary ?? ""), intent: text });
      setMessages((m) => [...m, { role: "assistant", text: data.summary }]);
    } catch (err) {
      const msg = err instanceof Error && err.name !== "TimeoutError" ? err.message : "The AI took too long.";
      setMessages((m) => [...m, { role: "error", text: `${msg} The current mapping is still live.` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="flex min-h-0 flex-col gap-2" aria-label="Assistant" data-tour="assistant">
      <div className={`${box} p-2.5`}>
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wide text-muted uppercase">Live mapping</h2>
          <button type="button" onClick={onResetDefault} className="text-[11px] text-muted hover:text-text">
            Reset to default
          </button>
        </div>
        <p className="mt-1 text-[13px] leading-snug">{activeSummary}</p>
        <div className="mt-2 border-t border-border">
          <Collapsible title="Choose what each hand controls" level="item">
            <div className="flex flex-col gap-2.5">
              {GESTURES.map((g) => (
                <HandPicker key={g} gesture={g} mapping={mapping} modules={modules} onToggle={onToggleParam} />
              ))}
            </div>
          </Collapsible>
        </div>
      </div>

      <div className={`flex min-h-0 flex-1 flex-col ${box}`}>
        <div className="flex max-h-56 flex-1 flex-col gap-1.5 overflow-y-auto p-2.5" aria-live="polite">
          {messages.length === 0 && (
            <p className="text-[13px] leading-snug text-muted">
              {mode === "ask"
                ? "Ask anything about what you're hearing. Answers use the effects in this rack."
                : "Tell the rack what you want to hear. The AI maps your pinch for you."}
            </p>
          )}
          {messages.map((m, i) => (
            <p
              key={i}
              className={`max-w-[90%] rounded-xl px-2.5 py-1.5 text-[13px] leading-snug ${
                m.role === "user"
                  ? "self-end bg-accent text-white shadow-[0_4px_14px_-6px_var(--accent)]"
                  : m.role === "error"
                    ? "border border-danger/40 bg-danger/10 text-danger"
                    : "border border-border"
              }`}
            >
              {m.text}
            </p>
          ))}
          {voice !== "idle" && (
            <p className="text-[13px] text-muted" role="status">
              {voice === "recording" ? "Listening... tap the mic again to send." : "Transcribing what you said..."}
            </p>
          )}
          {loading && (
            <p className="text-[13px] text-muted">{mode === "ask" ? "Thinking it through..." : "Thinking about your sound..."}</p>
          )}
          {proposal && (
            <MappingCard
              proposal={proposal}
              onApprove={() => {
                onApprove(proposal);
                setProposal(null);
                setMessages((m) => [...m, { role: "assistant", text: "Applied. Your pinch now drives the new mapping." }]);
              }}
              onReject={() => {
                setProposal(null);
                setMessages((m) => [...m, { role: "assistant", text: "Discarded. Keeping the current mapping." }]);
              }}
            />
          )}
        </div>

        {lesson && (
          <div className="mx-2.5 mt-1 flex rounded-full bg-black/[0.06] p-0.5 text-[11px]" role="tablist" aria-label="Assistant mode">
            {(
              [
                ["ask", "Ask a question"],
                ["map", "Change the sound"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full px-2 py-1 transition-colors ${mode === m ? "bg-white font-medium text-[#111] shadow-[0_1px_3px_rgb(0_0_0/0.14)]" : "text-muted hover:text-text"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1 border-t border-border px-2.5 pt-2" data-tour="ask-chips">
          {(mode === "ask" ? (lesson?.asks ?? []) : (lesson?.tries ?? STUDIO_TRIES)).map((p) => (
            <button
              key={p}
              type="button"
              disabled={loading}
              onClick={() => submit(p)}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-accent/60 hover:bg-accent/10 hover:text-accent-text disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
        <form
          className="flex gap-1.5 p-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "ask" ? "Why does feedback build up?" : "Make it dreamier..."}
            maxLength={500}
            className="min-w-0 flex-1 rounded-lg border border-border bg-panel-raised px-2.5 py-1.5 text-[13px] placeholder:text-muted focus:border-accent/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void toggleRecording()}
            disabled={voice === "transcribing" || (loading && voice === "idle")}
            aria-pressed={voice === "recording"}
            title={voice === "recording" ? "Stop and send" : "Speak your request (up to 15 seconds)"}
            aria-label={
              voice === "recording" ? "Stop recording and send" : voice === "transcribing" ? "Transcribing" : "Speak your request"
            }
            className={`press flex w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
              voice === "recording" ? "animate-pulse border-accent bg-accent text-white" : "border-border text-muted hover:text-text"
            }`}
          >
            {voice === "recording" ? (
              <span className="size-2.5 rounded-[3px] bg-white" aria-hidden />
            ) : (
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="7" y="2.5" width="6" height="10" rx="3" />
                <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-lg bg-ink px-3 text-[13px] font-semibold text-on-ink disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </aside>
  );
}

function HandPicker({
  gesture,
  mapping,
  modules,
  onToggle,
}: {
  gesture: Gesture;
  mapping: Mapping;
  modules: readonly EffectId[];
  onToggle: (gesture: Gesture, plugin: string, param: string) => void;
}) {
  const otherGesture = GESTURES.find((g) => g !== gesture)!;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[13px] font-semibold text-text">{GESTURE_LABEL[gesture]}</p>
      <div className="flex flex-col gap-1">
        {modules.map((id) => {
          const specs = specsForPlugin(id);
          if (specs.length === 0) return null;
          const plugin = PLUGINS.find((p) => p.id === id)?.label ?? id;
          return (
            <div
              key={id}
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label={`${GESTURE_LABEL[gesture]} ${plugin} targets`}
            >
              <span className="text-[10px] text-muted">{plugin}:</span>
              <div className="flex flex-wrap gap-1">
                {specs.map((spec) => {
                  const bound = isTargetBound(mapping, gesture, spec.plugin, spec.param);
                  const takenByOtherHand = !bound && isTargetBound(mapping, otherGesture, spec.plugin, spec.param);
                  return (
                    <button
                      key={`${spec.plugin}.${spec.param}`}
                      type="button"
                      disabled={takenByOtherHand}
                      onClick={() => onToggle(gesture, spec.plugin, spec.param)}
                      aria-pressed={bound}
                      title={takenByOtherHand ? `${GESTURE_LABEL[otherGesture]} already controls this` : undefined}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        bound
                          ? "bg-accent/15 text-accent-text"
                          : takenByOtherHand
                            ? "cursor-not-allowed border border-border/50 text-muted/40"
                            : "border border-border text-muted hover:border-accent/60 hover:text-accent-text"
                      }`}
                    >
                      {spec.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MappingCard({ proposal, onApprove, onReject }: { proposal: Proposal; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="rounded-xl border border-accent/50 bg-accent/5 p-3">
      <p className="text-xs font-semibold tracking-wide text-accent-text uppercase">Proposed mapping</p>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
        {proposal.mapping.mappings.flatMap((m) =>
          m.targets.map((t) => {
            const spec = getParamSpec(t.plugin, t.param);
            const plugin = PLUGINS.find((p) => p.id === t.plugin)?.label ?? t.plugin;
            if (!spec) return null;
            return (
              <li key={`${m.gesture}-${t.plugin}-${t.param}`} className="flex justify-between gap-2">
                <span>
                  <span className="text-muted">{GESTURE_LABEL[m.gesture]}:</span> {plugin} {spec.label}
                </span>
                <span className="font-mono text-xs text-muted">
                  {formatParam(spec, t.min)} to {formatParam(spec, t.max)}
                </span>
              </li>
            );
          }),
        )}
      </ul>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onApprove} className="rounded-xl bg-ink px-3 py-1.5 text-sm font-semibold text-on-ink">
          Approve
        </button>
        <button
          type="button"
          onClick={onReject}
          className="rounded-xl border border-border bg-inset px-3 py-1.5 text-sm text-muted hover:text-text"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
