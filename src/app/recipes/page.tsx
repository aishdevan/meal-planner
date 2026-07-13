"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Bookmark as BookmarkIcon,
  Camera,
  Clock,
  Dice5,
  Dumbbell,
  ExternalLink,
  Flame,
  PencilLine,
  Search,
  Settings,
  Sparkles,
  Star,
  Wheat,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Bookmark, Recipe } from "@/lib/types";
import type { IngestResult } from "@/lib/schemas";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "breakfast", label: "Breakfast" },
  { key: "school_lunch", label: "Lunchbox" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "quick", label: "≤30 min" },
  { key: "favorites", label: "★ Favs" },
];

export default function RecipesPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => api<{ recipes: Recipe[] }>("/api/recipes"),
  });
  const { data: bookmarksData } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => api<{ bookmarks: Bookmark[] }>("/api/bookmarks"),
  });
  const pending = (bookmarksData?.bookmarks ?? []).filter(
    (b) => b.status === "saved",
  ).length;

  const favorite = useMutation({
    mutationFn: (r: Recipe) =>
      api(`/api/recipes/${r.id}`, {
        method: "PATCH",
        json: { isFavorite: !r.isFavorite },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });

  const recipes = (data?.recipes ?? [])
    .filter((r) => {
      if (filter === "quick") return r.totalTimeMinutes <= 30;
      if (filter === "favorites") return r.isFavorite;
      if (filter !== "all") return r.mealTypes.includes(filter);
      return true;
    })
    .filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
    .sort(
      (a, b) =>
        Number(b.isFavorite) - Number(a.isFavorite) ||
        a.title.localeCompare(b.title),
    );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Recipes</h1>
        <div className="flex gap-2">
          <Link
            href="/surprise"
            className="btn-secondary flex items-center gap-1.5 px-3.5 py-2 text-sm text-terra"
          >
            <Dice5 size={15} /> Surprise
          </Link>
          <Link
            href="/settings"
            className="btn-secondary flex items-center px-3 py-2"
          >
            <Settings size={16} />
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/bookmarks"
          className="card flex items-center gap-2 px-3.5 py-3 text-sm font-medium text-terra"
        >
          <BookmarkIcon size={16} className="shrink-0" />
          <span>
            Saved links{pending > 0 ? ` (${pending})` : ""} — Instagram →
          </span>
        </Link>
        <button
          onClick={() => setShowAdd(true)}
          className="card flex items-center gap-2 px-3.5 py-3 text-left text-sm font-medium text-accent-deep"
        >
          <PencilLine size={16} className="shrink-0" />
          <span>Add your own recipe</span>
        </button>
      </div>

      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes…"
          className="input w-full pl-9"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === f.key
                ? "bg-accent text-on-accent"
                : "border border-line bg-glass text-soft"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-faint">Loading…</p>}
      {!isLoading && recipes.length === 0 && (
        <p className="text-center text-sm text-faint">No recipes match.</p>
      )}

      <div className="space-y-2">
        {recipes.map((r) => (
          <div key={r.id} className="card flex items-center">
            <Link href={`/recipes/${r.id}`} className="min-w-0 flex-1 p-3.5">
              <div className="font-semibold tracking-tight">{r.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-soft">
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} /> {r.totalTimeMinutes}min
                </span>
                {r.nutrition && (
                  <span className="inline-flex items-center gap-1">
                    <Flame size={11} /> {r.nutrition.calories}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Dumbbell size={11} /> {r.proteinGBase}
                  {r.proteinGWithAddon ? `–${r.proteinGWithAddon}` : ""}g
                </span>
                {r.avgRating && <span>★ {r.avgRating}</span>}
                {r.timesCooked > 0 && <span>{r.timesCooked}× cooked</span>}
              </div>
              {r.sourceName && (
                <div className="mt-1 flex items-center gap-1 truncate text-[10px] text-faint">
                  <BookOpen size={10} className="shrink-0" />
                  <span className="truncate">{r.sourceName}</span>
                  {r.source === "ai" && (
                    <Sparkles size={10} className="shrink-0 text-accent-deep" />
                  )}
                  {r.source === "imported" && (
                    <Camera size={10} className="shrink-0 text-terra" />
                  )}
                </div>
              )}
            </Link>
            <div className="flex flex-col items-center">
              <button
                onClick={() => favorite.mutate(r)}
                className={`px-4 pb-1 pt-3 ${
                  r.isFavorite ? "text-accent" : "text-faint/50"
                }`}
              >
                <Star size={20} fill={r.isFavorite ? "currentColor" : "none"} />
              </button>
              {r.sourceUrl && (
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 pb-3 pt-1 text-terra"
                  aria-label="Open original recipe"
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddRecipeSheet
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["recipes"] });
          }}
        />
      )}
    </div>
  );
}

function AddRecipeSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<IngestResult | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parse = useMutation({
    mutationFn: () =>
      api<{ draft: IngestResult }>("/api/recipes/parse", {
        method: "POST",
        json: { text },
      }),
    onSuccess: ({ draft }) => {
      setError(null);
      setDraft(draft);
      setTitle(draft.recipe.title);
    },
    onError: (e) => setError(e.message),
  });

  const save = useMutation({
    mutationFn: () =>
      api("/api/recipes", {
        method: "POST",
        json: { recipe: { ...draft!.recipe, title } },
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });

  const r = draft?.recipe;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="sheet max-h-[88vh] w-full max-w-lg overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        {!r ? (
          <>
            <h3 className="text-lg font-bold tracking-tight">
              Add your own recipe
            </h3>
            <p className="mt-1 text-sm text-soft">
              Type it like you&apos;d tell a friend — rough ingredients and how
              you make it. I&apos;ll structure it, estimate nutrition, and tag
              it for the planner. You review before it&apos;s saved.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              autoFocus
              placeholder={
                "Aloo paratha\n\nDough: 2 cups atta, water, salt. Filling: 3 boiled potatoes mashed with green chili, cilantro, garam masala...\nRoll, stuff, roast on the tawa with ghee till golden both sides."
              }
              className="input mt-3 w-full"
            />
            {error && <p className="mt-2 text-sm text-bad">{error}</p>}
            <button
              onClick={() => parse.mutate()}
              disabled={text.trim().length < 10 || parse.isPending}
              className="btn-primary mt-3 flex w-full items-center justify-center gap-1.5 py-3 disabled:opacity-50"
            >
              <Sparkles size={15} />
              {parse.isPending ? "Structuring your recipe…" : "Structure it"}
            </button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold tracking-tight">
              Here&apos;s how I read it
            </h3>
            {draft?.confidence_note && (
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
                <Wheat size={11} /> {r.nutrition.carbs_g}g carbs ·{" "}
                {r.nutrition.fat_g}g fat
              </span>
              {r.meal_types.map((m) => (
                <span key={m} className="chip bg-good-soft text-good">
                  {m.replace("_", " ")}
                </span>
              ))}
              {r.is_nut_free && r.no_reheat_ok && (
                <span className="chip bg-good-soft text-good">lunchbox-ok</span>
              )}
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
            {error && <p className="mt-2 text-sm text-bad">{error}</p>}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setDraft(null)}
                className="btn-secondary flex-1 py-3"
              >
                Edit my text
              </button>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending || !title.trim()}
                className="btn-primary flex-1 py-3 disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save to recipe box"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
