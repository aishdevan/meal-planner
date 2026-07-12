"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronLeft,
  Clock,
  Dice5,
  Dumbbell,
  Flame,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Suggestion } from "@/lib/types";
import type { NewRecipe } from "@/lib/schemas";

export default function SurprisePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["suggestions"],
    queryFn: () => api<{ suggestions: Suggestion[] }>("/api/suggestions"),
  });

  const surprise = useMutation({
    mutationFn: () => api("/api/surprise", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suggestions"] }),
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "dismiss" }) =>
      api(`/api/suggestions/${id}`, { method: "PATCH", json: { action } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suggestions"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const suggestions = data?.suggestions ?? [];

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
          Surprise us
        </h1>
        <p className="text-sm text-soft">
          Something new, adjacent to what you already love.
        </p>
      </header>

      <button
        onClick={() => surprise.mutate()}
        disabled={surprise.isPending}
        className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-lg disabled:opacity-60"
      >
        <Dice5 size={20} />
        {surprise.isPending ? "Cooking up an idea…" : "Surprise us!"}
      </button>
      {surprise.isError && (
        <p className="rounded-2xl bg-bad-soft px-4 py-2.5 text-sm text-bad">
          {surprise.error.message}
        </p>
      )}

      {isLoading && <p className="text-faint">Loading…</p>}

      <div className="space-y-3">
        {suggestions.map((s) => {
          const recipe = s.recipeSnapshot as NewRecipe;
          return (
            <div
              key={s.id}
              className={`card p-4 ${
                s.status === "dismissed"
                  ? "opacity-45"
                  : s.status === "accepted"
                    ? "ring-1 ring-good/40"
                    : "ring-1 ring-terra/30"
              }`}
            >
              <p className="text-sm font-medium text-terra">“{s.reason}”</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight">
                {recipe.title}
              </h2>
              <p className="mt-0.5 text-sm text-soft">{recipe.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-soft">
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} /> {recipe.total_time_minutes} min
                </span>
                {recipe.nutrition && (
                  <span className="inline-flex items-center gap-1">
                    <Flame size={12} /> {recipe.nutrition.calories} kcal
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Dumbbell size={12} /> {recipe.protein_g_base}
                  {recipe.protein_g_with_addon
                    ? `–${recipe.protein_g_with_addon}`
                    : ""}
                  g protein
                </span>
                {recipe.nonveg_addon && (
                  <span className="text-terra">+ {recipe.nonveg_addon.name}</span>
                )}
              </div>
              {recipe.source_attribution && (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-faint">
                  <BookOpen size={10} /> {recipe.source_attribution}
                </p>
              )}
              {s.status === "proposed" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => act.mutate({ id: s.id, action: "dismiss" })}
                    className="btn-secondary flex-1 py-2.5 text-sm"
                  >
                    Not for us
                  </button>
                  <button
                    onClick={() => act.mutate({ id: s.id, action: "accept" })}
                    className="btn-primary flex-1 py-2.5 text-sm"
                  >
                    Add to recipe box
                  </button>
                </div>
              )}
              {s.status === "accepted" && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-good">
                  <Check size={13} /> in your recipe box — it&apos;ll show up in
                  future plans
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
