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
  Flame,
  Search,
  Settings,
  Sparkles,
  Star,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Bookmark, Recipe } from "@/lib/types";

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

      <Link
        href="/bookmarks"
        className="card flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-terra"
      >
        <BookmarkIcon size={16} />
        Saved links{pending > 0 ? ` (${pending} waiting)` : ""} — import from
        Instagram →
      </Link>

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
            <button
              onClick={() => favorite.mutate(r)}
              className={`px-4 py-3 ${
                r.isFavorite ? "text-accent" : "text-faint/50"
              }`}
            >
              <Star size={20} fill={r.isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
