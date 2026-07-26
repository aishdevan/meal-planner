"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mic, Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

/** One proposed change, opaque to this component beyond the display fields.
 *  The server echoes the full update objects back through apply. */
export type VoiceUpdate = Record<string, unknown> & {
  interpreted_as: string;
  badge?: string | null;
};
type Proposal = { updates: VoiceUpdate[]; note: string | null };

/**
 * Dictation command bar (same pattern as the Week tab's): type or use the
 * keyboard mic → server parses into concrete changes → review sheet → apply.
 */
export function VoiceBar({
  placeholder,
  hint,
  parsePath,
  applyPath,
  extra,
  emptyMessage,
  onApplied,
}: {
  placeholder: string;
  hint: string;
  parsePath: string;
  applyPath: string;
  /** Extra JSON merged into both the parse and apply request bodies (e.g. weekStart). */
  extra?: Record<string, unknown>;
  emptyMessage: string;
  onApplied: () => void;
}) {
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [result, setResult] = useState<{
    applied: string[];
    skipped: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parse = useMutation({
    mutationFn: () =>
      api<{ proposal: Proposal }>(parsePath, {
        method: "POST",
        json: { text, ...extra },
      }),
    onSuccess: ({ proposal }) => {
      setError(null);
      setProposal(proposal);
    },
    onError: (e) => setError(e.message),
  });

  const apply = useMutation({
    mutationFn: (updates: VoiceUpdate[]) =>
      api<{ applied: string[]; skipped: string[] }>(applyPath, {
        method: "POST",
        json: { updates, ...extra },
      }),
    onSuccess: (res) => {
      setProposal(null);
      setText("");
      setResult(res);
      onApplied();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) parse.mutate();
        }}
        className="relative"
      >
        <Mic
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-accent"
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="input w-full pl-9 pr-11"
        />
        <button
          type="submit"
          disabled={!text.trim() || parse.isPending}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-accent p-1.5 text-on-accent disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </form>
      <p className="mt-1 pl-1 text-[10px] text-faint">{hint}</p>
      {parse.isPending && (
        <p className="mt-1 pl-1 text-xs text-soft">Working out what you meant…</p>
      )}
      {error && (
        <p className="mt-1 rounded-2xl bg-bad-soft px-3.5 py-2 text-xs text-bad">
          {error}
        </p>
      )}
      {result && (
        <div className="mt-2 rounded-2xl bg-good-soft px-3.5 py-2.5 text-xs text-good">
          {result.applied.map((a) => (
            <div key={a}>✓ {a}</div>
          ))}
          {result.skipped.map((s) => (
            <div key={s} className="text-bad">
              ✕ {s}
            </div>
          ))}
          <button onClick={() => setResult(null)} className="mt-1 underline">
            dismiss
          </button>
        </div>
      )}

      {proposal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setProposal(null)}
        >
          <div
            className="sheet max-h-[80vh] w-full max-w-lg overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold tracking-tight">
              Here&apos;s what I heard
            </h3>
            {proposal.note && (
              <p className="mt-1.5 rounded-2xl bg-accent-soft px-3.5 py-2.5 text-xs text-accent-deep">
                {proposal.note}
              </p>
            )}
            {proposal.updates.length === 0 ? (
              <p className="mt-3 text-sm text-soft">{emptyMessage}</p>
            ) : (
              <div className="mt-3 space-y-2">
                {proposal.updates.map((u, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-line bg-surface/60 px-3.5 py-2.5"
                  >
                    <div className="text-sm font-medium">{u.interpreted_as}</div>
                    {u.badge && (
                      <span className="chip mt-1 bg-accent-soft text-[10px] font-semibold text-accent-deep">
                        <Sparkles size={10} /> {u.badge}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setProposal(null)}
                className="btn-secondary flex-1 py-3"
              >
                Cancel
              </button>
              <button
                onClick={() => apply.mutate(proposal.updates)}
                disabled={proposal.updates.length === 0 || apply.isPending}
                className="btn-primary flex-1 py-3 disabled:opacity-50"
              >
                {apply.isPending
                  ? "Applying…"
                  : `Apply ${proposal.updates.length} change${proposal.updates.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
