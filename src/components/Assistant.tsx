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

const PRESETS = ["Make it dreamier", "Darker and tighter", "Huge slapback echo", "Wide open space"];

interface Props {
  modules: readonly EffectId[];
  activeSummary: string;
  onApprove: (proposal: Proposal) => void;
  onResetDefault: () => void;
}

export function Assistant({ modules, activeSummary, onApprove, onResetDefault }: Props) {
  // Inset boxes: the assistant always sits inside its own glass panel.
  const box = "rounded-xl border border-border bg-inset";
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const submit = async (intent: string) => {
    const text = intent.trim();
    if (!text || loading) return;
    setInput("");
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
    <aside className="flex min-h-0 flex-col gap-2" aria-label="Assistant">
      <div className={`${box} p-2.5`}>
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wide text-muted uppercase">Live mapping</h2>
          <button type="button" onClick={onResetDefault} className="text-[11px] text-muted hover:text-text">
            Reset to default
          </button>
        </div>
        <p className="mt-1 text-[13px] leading-snug">{activeSummary}</p>
      </div>

      <div className={`flex min-h-0 flex-1 flex-col ${box}`}>
        <div className="flex max-h-56 flex-1 flex-col gap-1.5 overflow-y-auto p-2.5" aria-live="polite">
          {messages.length === 0 && (
            <p className="text-[13px] leading-snug text-muted">Tell the rack what you want to hear. The AI maps your pinch for you.</p>
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
          {loading && <p className="text-[13px] text-muted">Thinking about your sound...</p>}
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

        <div className="flex flex-wrap gap-1 border-t border-border px-2.5 pt-2">
          {PRESETS.map((p) => (
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
            placeholder="Make it dreamier..."
            maxLength={500}
            className="min-w-0 flex-1 rounded-lg border border-border bg-panel-raised px-2.5 py-1.5 text-[13px] placeholder:text-muted focus:border-accent/60 focus:outline-none"
          />
          <button
            type="button"
            disabled
            title="Voice control with ElevenLabs is coming next"
            className="flex w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted opacity-50"
            aria-label="Voice input (coming soon)"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="7" y="2.5" width="6" height="10" rx="3" />
              <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" strokeLinecap="round" />
            </svg>
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
