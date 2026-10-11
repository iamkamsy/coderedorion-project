"use client";

import { useState } from "react";
import { getParamSpec, specsForPlugin, PLUGINS } from "@/audio/paramSchema";
import type { MappingPreset } from "@/mapping/defaults";
import { isTargetBound } from "@/mapping/engine";
import { GESTURES, type Gesture, type Mapping } from "@/mapping/types";
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

const INTENT_SUGGESTIONS = ["Make it dreamier", "Darker and tighter", "Huge slapback echo", "Wide open space"];

interface Props {
  activeSummary: string;
  onApprove: (proposal: Proposal) => void;
  presets: MappingPreset[];
  activePresetId: string | null;
  onSelectPreset: (preset: MappingPreset) => void;
  mapping: Mapping;
  onToggleParam: (gesture: Gesture, plugin: string, param: string) => void;
}

export function Assistant({ activeSummary, onApprove, presets, activePresetId, onSelectPreset, mapping, onToggleParam }: Props) {
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
        body: JSON.stringify({ intent: text }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The AI request failed.");
      const valid = validateMapping(data.mapping);
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
    <aside className="flex flex-1 flex-col gap-3 xl:min-h-0" aria-label="Assistant">
      <div className="rounded-[var(--radius-panel)] border border-border bg-panel p-4">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Live mapping</h2>
        <p className="mt-2 text-sm">{activeSummary}</p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Mapping presets">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              aria-pressed={activePresetId === preset.id}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                activePresetId === preset.id
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-border text-muted hover:border-accent/60 hover:text-text"
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-[11px] text-muted">Choose what each hand controls:</p>
          {GESTURES.map((g) => (
            <HandPicker key={g} gesture={g} mapping={mapping} onToggle={onToggleParam} />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col rounded-[var(--radius-panel)] border border-border bg-panel xl:min-h-0">
        <div className="flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && (
            <p className="text-sm text-muted">Tell the rack what you want to hear. The AI proposes which parameters your pinch controls.</p>
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
          {loading && <p className="text-sm text-muted">Thinking about your sound...</p>}
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

        <div className="flex flex-wrap gap-1.5 border-t border-border px-4 pt-3">
          {INTENT_SUGGESTIONS.map((p) => (
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
            placeholder="Make the vocals dreamier..."
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

function HandPicker({
  gesture,
  mapping,
  onToggle,
}: {
  gesture: Gesture;
  mapping: Mapping;
  onToggle: (gesture: Gesture, plugin: string, param: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium">{GESTURE_LABEL[gesture]}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${GESTURE_LABEL[gesture]} targets`}>
        {PLUGINS.flatMap((plugin) =>
          specsForPlugin(plugin.id).map((spec) => {
            const bound = isTargetBound(mapping, gesture, spec.plugin, spec.param);
            return (
              <button
                key={`${spec.plugin}.${spec.param}`}
                type="button"
                onClick={() => onToggle(gesture, spec.plugin, spec.param)}
                aria-pressed={bound}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  bound
                    ? "border-accent/60 bg-accent/10 text-accent"
                    : "border-border text-muted hover:border-accent/60 hover:text-text"
                }`}
              >
                {plugin.label} {spec.label}
              </button>
            );
          }),
        )}
      </div>
    </div>
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
