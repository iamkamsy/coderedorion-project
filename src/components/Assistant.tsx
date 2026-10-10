"use client";

import { useState } from "react";
import { getParamSpec, PLUGINS } from "@/audio/paramSchema";
import type { EffectId } from "@/audio/rackSpec";
import type { Mapping } from "@/mapping/types";
import { validateMapping } from "@/mapping/validate";
import { GESTURE_LABEL, formatParam } from "@/lib/format";
import { ownerHeaders } from "@/lib/ownerId";

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
  /** In a tutorial: questions to suggest, and the lesson the answers are about. */
  lesson?: { slug: string; asks: readonly string[]; tries: readonly string[] };
  onAsked?: () => void;
}

export function Assistant({ modules, activeSummary, onApprove, onResetDefault, lesson, onAsked }: Props) {
  // The studio only changes the sound; a tutorial starts on questions.
  const [mode, setMode] = useState<Mode>(lesson ? "ask" : "map");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
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

  const submit = async (raw: string, as: Mode = mode) => {
    const text = raw.trim();
    if (!text || loading) return;
    setInput("");
    if (as === "ask") return ask(text);
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
    <aside className="flex flex-1 flex-col gap-3 xl:min-h-0" aria-label="Assistant" data-tour="assistant">
      <div className="rounded-[var(--radius-panel)] border border-border bg-panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Live mapping</h2>
          <button type="button" onClick={onResetDefault} className="text-xs text-muted hover:text-text">
            Reset to default
          </button>
        </div>
        <p className="mt-2 text-sm">{activeSummary}</p>
      </div>

      <div className="flex flex-1 flex-col rounded-[var(--radius-panel)] border border-border bg-panel xl:min-h-0">
        <div className="flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && (
            <p className="text-sm text-muted">
              {mode === "ask"
                ? "Ask anything about what you're hearing. Answers use the effects in this rack."
                : "Tell the rack what you want to hear. The AI proposes which parameters your pinch controls."}
            </p>
          )}
          {messages.map((m, i) => (
            <p
              key={i}
              className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "self-end bg-panel-raised"
                  : m.role === "error"
                    ? "border border-danger/40 bg-danger/10 text-danger"
                    : "border border-border"
              }`}
            >
              {m.text}
            </p>
          ))}
          {loading && <p className="text-sm text-muted">{mode === "ask" ? "Thinking it through..." : "Thinking about your sound..."}</p>}
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
          <div className="flex border-t border-border px-4 pt-3" role="tablist" aria-label="Assistant mode">
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
                className={`flex-1 border-b-2 pb-1.5 text-xs font-medium ${mode === m ? "border-accent text-text" : "border-transparent text-muted hover:text-text"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 border-t border-border px-4 pt-3" data-tour="ask-chips">
          {(mode === "ask" ? (lesson?.asks ?? []) : (lesson?.tries ?? STUDIO_TRIES)).map((p) => (
            <button
              key={p}
              type="button"
              disabled={loading}
              onClick={() => submit(p)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-accent/60 hover:text-text disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "ask" ? "Why does feedback build up?" : "Make the vocals dreamier..."}
            maxLength={500}
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm placeholder:text-muted focus:border-accent/60 focus:outline-none"
          />
          <button
            type="button"
            disabled
            title="Voice control with ElevenLabs is coming next"
            className="rounded-lg border border-border px-3 text-sm text-muted opacity-50"
            aria-label="Voice input (coming soon)"
          >
            Mic
          </button>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-accent px-3 text-sm font-medium text-bg disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </aside>
  );
}

function MappingCard({ proposal, onApprove, onReject }: { proposal: Proposal; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="rounded-xl border border-accent/50 bg-accent/5 p-3">
      <p className="text-xs font-semibold tracking-wide text-accent uppercase">Proposed mapping</p>
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
        <button type="button" onClick={onApprove} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg">
          Approve
        </button>
        <button type="button" onClick={onReject} className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-text">
          Reject
        </button>
      </div>
    </div>
  );
}
