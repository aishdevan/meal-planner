"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ExternalLink, Star } from "lucide-react";
import { api } from "@/lib/api";
import type { Recipe } from "@/lib/types";
import { RecipeView } from "@/components/RecipeView";

export default function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["recipe", id],
    queryFn: () => api<{ recipe: Recipe }>(`/api/recipes/${id}`),
  });
  const favorite = useMutation({
    mutationFn: (r: Recipe) =>
      api(`/api/recipes/${r.id}`, {
        method: "PATCH",
        json: { isFavorite: !r.isFavorite },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipe", id] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const recipe = data?.recipe;
  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3 pt-3">
        <div className="min-w-0">
          <Link
            href="/recipes"
            className="inline-flex items-center gap-0.5 text-sm text-faint"
          >
            <ChevronLeft size={15} /> Recipes
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {recipe?.title ?? (isLoading ? "Loading…" : "Not found")}
          </h1>
          {recipe?.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-terra underline underline-offset-2"
            >
              View source recipe <ExternalLink size={11} />
            </a>
          )}
        </div>
        {recipe && (
          <button
            onClick={() => favorite.mutate(recipe)}
            className={recipe.isFavorite ? "text-accent" : "text-faint/50"}
          >
            <Star
              size={28}
              fill={recipe.isFavorite ? "currentColor" : "none"}
            />
          </button>
        )}
      </header>
      {recipe && (
        <div className="card p-4">
          <RecipeView recipe={recipe} />
        </div>
      )}
    </div>
  );
}
