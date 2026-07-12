"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ClipboardPaste,
  Clock,
  Dumbbell,
  ExternalLink,
  Flame,
  Sparkles,
  Wheat,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Bookmark } from "@/lib/types";
import type { IngestResult } from "@/lib/schemas";

export default function BookmarksPage() {
  const [url, setUrl] = useState("");
  const qc = useQueryClient();
  const [draftFor, setDraftFor] = useState<{
    bookmark: Bookmark;
    draft: IngestResult;
  } | null>(null);
  const [pasteFor, setPasteFor] = useState<Bookmark | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => api<{ bookmarks: Bookmark[] }>("/api/bookmarks"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["bookmarks"] });

  const add = useMutation({
    mutationFn: () => api("/api/bookmarks", { method: "POST", json: { url } }),
    onSuccess: () => {
      setUrl("");
      setError(null);
      invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const ingest = useMutation({
    mutationFn: (bookmark: Bookmark) =>
      api<{ draft: IngestResult }>(`/api/bookmarks/${bookmark.id}/ingest`, {
        method: "POST",
      }).then((res) => ({ bookmark, draft: res.draft })),
    onSuccess: (result) => {
      setError(null);
      setDraftFor(result);
    },
    onError: (e, bookmark) => {
      if (e instanceof ApiError && e.status === 422) {
        setPasteFor(bookmark);
      } else {
        setError(e.message);
      }
    },
  });

  const dismiss = useMutation({
    mutationFn: (id: string) =>
      api(`/api/bookmarks/${id}`, {
        method: "PATCH",
        json: { status: "dismissed" },
      }),
    onSuccess: invalidate,
  });

  const bookmarks = (data?.bookmarks ?? []).filter(
    (b) => b.status !== "dismissed",
  );

  return (
    <div className="space-y-4">
      <header className="pt-3">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-0.5 text-sm text-faint"
        >
          <ChevronLeft size={15} /> Recipes
        </Link>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight">
          Saved links
        </h1>
        <p className="text-sm text-soft">
          Share from Instagram with the Shortcut (see{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Settings
          </Link>
          ), or paste a link below.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) add.mutate();
        }}
        className="flex gap-2"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste an Instagram / recipe link…"
          className="input min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={!url.trim() || add.isPending}
          className="btn-primary px-4 text-sm disabled:opacity-40"
        >
          {add.isPending ? "…" : "Save"}
        </button>
      </form>
      {error && (
        <p className="rounded-2xl bg-bad-soft px-4 py-2.5 text-sm text-bad">
          {error}
        </p>
      )}

      {isLoading && <p className="text-faint">Loading…</p>}
      {!isLoading && bookmarks.length === 0 && (
        <div className="card border-dashed p-8 text-center text-sm text-soft">
          Nothing saved yet. Next time you see a tasty reel, share it here!
        </div>
      )}

      <div className="space-y-2">
        {bookmarks.map((b) => (
          <div key={b.id} className="card p-3.5">
            <div className="flex gap-3">
              {b.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.thumbnail}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold tracking-tight">
                  {b.title ?? b.url.replace(/^https?:\/\/(www\.)?/, "")}
                </div>
                {b.ogText && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-soft">
                    {b.ogText}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-3">
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-terra underline underline-offset-2"
                  >
                    open <ExternalLink size={10} />
                  </a>
                  {b.status === "ingested" && (
                    <span className="inline-flex items-center gap-1 text-xs text-good">
                      <Check size={12} /> in recipe box
                    </span>
                  )}
                </div>
              </div>
            </div>
            {b.status === "saved" && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => ingest.mutate(b)}
                  disabled={ingest.isPending}
                  className="btn-primary flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  {ingest.isPending && ingest.variables?.id === b.id
                    ? "Reading the recipe…"
                    : "Turn into recipe"}
                </button>
                <button
                  onClick={() => setPasteFor(b)}
                  className="btn-secondary flex items-center gap-1.5 px-3 py-2.5 text-sm"
                >
                  <ClipboardPaste size={14} /> caption
                </button>
                <button
                  onClick={() => dismiss.mutate(b.id)}
                  className="px-2 py-2.5 text-faint"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {pasteFor && (
        <PasteCaptionSheet
          bookmark={pasteFor}
          onClose={() => setPasteFor(null)}
          onSaved={(updated) => {
            setPasteFor(null);
            invalidate();
            ingest.mutate(updated);
          }}
        />
      )}
      {draftFor && (
        <DraftSheet
          bookmark={draftFor.bookmark}
          draft={draftFor.draft}
          onClose={() => setDraftFor(null)}
          onConfirmed={() => {
            setDraftFor(null);
            invalidate();
            qc.invalidateQueries({ queryKey: ["recipes"] });
          }}
        />
      )}
    </div>
  );
}

function PasteCaptionSheet({
  bookmark,
  onClose,
  onSaved,
}: {
  bookmark: Bookmark;
  onClose: () => void;
  onSaved: (updated: Bookmark) => void;
}) {
  const [text, setText] = useState(bookmark.pastedText ?? "");
  const save = useMutation({
    mutationFn: () =>
      api(`/api/bookmarks/${bookmark.id}`, {
        method: "PATCH",
        json: { pastedText: text },
      }),
    onSuccess: () => onSaved({ ...bookmark, pastedText: text }),
  });
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="sheet w-full max-w-lg p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold tracking-tight">Paste the caption</h3>
        <p className="mt-1 text-sm text-soft">
          Instagram often hides captions from apps. Copy the post&apos;s caption
          (with the recipe) and paste it here — then we&apos;ll parse it.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Paste the recipe caption…"
          className="input mt-3 w-full"
        />
        <button
          onClick={() => save.mutate()}
          disabled={!text.trim() || save.isPending}
          className="btn-primary mt-3 flex w-full items-center justify-center gap-1.5 py-3 disabled:opacity-50"
        >
          <Sparkles size={15} /> Save &amp; parse
        </button>
      </div>
    </div>
  );
}

function DraftSheet({
  bookmark,
  draft,
  onClose,
  onConfirmed,
}: {
  bookmark: Bookmark;
  draft: IngestResult;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [title, setTitle] = useState(draft.recipe.title);
  const confirm = useMutation({
    mutationFn: () =>
      api(`/api/bookmarks/${bookmark.id}/confirm`, {
        method: "POST",
        json: { recipe: { ...draft.recipe, title } },
      }),
    onSuccess: onConfirmed,
  });
  const r = draft.recipe;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="sheet max-h-[88vh] w-full max-w-lg overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold tracking-tight">
          Here&apos;s what I read
        </h3>
        {draft.confidence_note && (
          <p className="mt-1.5 rounded-2xl bg-accent-soft px-3.5 py-2.5 text-xs text-accent-deep">
            {draft.confidence_note}
          </p>
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input mt-3 w-full font-semibold"
        />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-faint">
          <BookOpen size={12} /> {r.source_attribution}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip bg-accent-soft text-accent-deep">
            <Clock size={11} /> {r.total_time_minutes} min
          </span>
          <span className="chip bg-accent-soft text-accent-deep">
            <Flame size={11} /> {r.nutrition.calories} kcal
          </span>
          <span className="chip bg-accent-soft text-accent-deep">
            <Dumbbell size={11} /> {r.protein_g_base}g protein
          </span>
          <span className="chip bg-accent-soft text-accent-deep">
            <Wheat size={11} /> {r.nutrition.carbs_g}g carbs · {r.nutrition.fat_g}
            g fat
          </span>
          {r.nonveg_addon && (
            <span className="chip bg-terra-soft text-terra">
              + {r.nonveg_addon.name}
            </span>
          )}
          {r.meal_types.map((m) => (
            <span key={m} className="chip bg-good-soft text-good">
              {m.replace("_", " ")}
            </span>
          ))}
        </div>
        <div className="mt-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-widest text-soft">
            Ingredients
          </h4>
          <ul className="mt-1 space-y-1 text-sm">
            {r.ingredients.map((i, idx) => (
              <li key={idx} className="flex justify-between">
                <span>{i.name}</span>
                <span className="text-faint">{i.qty_text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-widest text-soft">
            Steps
          </h4>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
            {r.steps.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ol>
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 py-3">
            Discard
          </button>
          <button
            onClick={() => confirm.mutate()}
            disabled={confirm.isPending}
            className="btn-primary flex-1 py-3 disabled:opacity-50"
          >
            {confirm.isPending ? "Saving…" : "Save to recipe box"}
          </button>
        </div>
      </div>
    </div>
  );
}
