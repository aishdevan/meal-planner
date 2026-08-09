"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clock,
  Dumbbell,
  Flame,
  Meh,
  Palmtree,
  Soup,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { mondayOf, todayString } from "@/lib/dates";
import type { Member, PlanEntry, PlanResponse, Recipe } from "@/lib/types";
import { SLOT_LABELS, SLOT_ORDER } from "@/lib/types";
import { RecipeView } from "@/components/RecipeView";

type CookedResult = {
  members: Member[];
  recipeId: string;
  cookedOn: string;
};

export default function TodayPage() {
  const today = todayString();
  const weekStart = mondayOf(today);
  const qc = useQueryClient();
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const [rateFor, setRateFor] = useState<CookedResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["plan", weekStart],
    queryFn: () => api<PlanResponse>(`/api/plan?weekStart=${weekStart}`),
  });

  const cook = useMutation({
    mutationFn: (entryId: string) =>
      api<CookedResult & { ok: boolean }>("/api/plan/cooked", {
        method: "POST",
        json: { entryId },
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["pantry"] });
      setOpenEntry(null);
      setRateFor(result);
    },
  });

  const recipeById = new Map((data?.recipes ?? []).map((r) => [r.id, r]));
  const todaysEntries = (data?.entries ?? [])
    .filter((e) => e.date === today)
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  const familyAway = data?.familyAwayDates.includes(today);

  return (
    <div className="space-y-4">
      <header className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Today</h1>
        <p className="text-sm text-soft">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      {isLoading && <p className="text-faint">Loading…</p>}

      {!isLoading && familyAway && (
        <div className="card p-8 text-center">
          <Palmtree className="mx-auto text-accent" size={36} />
          <p className="mt-3 font-medium">You&apos;re away today — no cooking!</p>
        </div>
      )}

      {!isLoading && !familyAway && todaysEntries.length === 0 && (
        <div className="card border-dashed p-8 text-center">
          <p className="text-soft">Nothing planned for today yet.</p>
          <a
            href="/week"
            className="btn-primary mt-4 inline-block px-5 py-2.5 text-sm"
          >
            Plan the week →
          </a>
        </div>
      )}

      {todaysEntries.map((entry) => {
        const recipe = recipeById.get(entry.recipeId);
        if (!recipe) return null;
        return (
          <MealCard
            key={entry.id}
            entry={entry}
            recipe={recipe}
            open={openEntry === entry.id}
            onToggle={() =>
              setOpenEntry(openEntry === entry.id ? null : entry.id)
            }
            onCooked={() => cook.mutate(entry.id)}
            cooking={cook.isPending}
          />
        );
      })}

      {rateFor && <RateSheet result={rateFor} onDone={() => setRateFor(null)} />}
    </div>
  );
}

function MealCard({
  entry,
  recipe,
  open,
  onToggle,
  onCooked,
  cooking,
}: {
  entry: PlanEntry;
  recipe: Recipe;
  open: boolean;
  onToggle: () => void;
  onCooked: () => void;
  cooking: boolean;
}) {
  const done = entry.status === "cooked";
  const leftover = entry.status === "leftover";
  return (
    <div className={`card overflow-hidden ${done ? "opacity-65" : ""}`}>
      <button onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-deep">
            {SLOT_LABELS[entry.slot]}
          </span>
          {done && (
            <span className="chip bg-good-soft font-semibold text-good">
              <Check size={11} /> cooked
            </span>
          )}
          {leftover && (
            <span className="chip bg-terra-soft font-semibold text-terra">
              <Soup size={11} /> leftovers
            </span>
          )}
        </div>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">
          {recipe.title}
        </h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-soft">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {recipe.totalTimeMinutes} min
          </span>
          {recipe.nutrition && (
            <span className="inline-flex items-center gap-1">
              <Flame size={12} /> {recipe.nutrition.calories} kcal
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Dumbbell size={12} /> {recipe.proteinGBase}
            {entry.includeAddon && recipe.proteinGWithAddon
              ? `–${recipe.proteinGWithAddon}`
              : ""}
            g
          </span>
          {entry.includeAddon && recipe.nonvegAddon && (
            <span className="text-terra">+ {recipe.nonvegAddon.name}</span>
          )}
        </p>
      </button>
      {open && (
        <div className="border-t border-line p-4">
          <RecipeView recipe={recipe} includeAddon={entry.includeAddon} />
          {leftover && (
            <p className="mt-4 flex items-center gap-1.5 rounded-2xl bg-terra-soft px-3.5 py-2.5 text-sm font-medium text-terra">
              <Soup size={15} /> Leftovers from a weekend cook — just reheat.
            </p>
          )}
          {!done && !leftover && (
            <button
              onClick={onCooked}
              disabled={cooking}
              className="btn-primary mt-5 w-full py-3.5 text-lg disabled:opacity-50"
            >
              {cooking ? "Saving…" : "Mark cooked"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RateSheet({
  result,
  onDone,
}: {
  result: CookedResult;
  onDone: () => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [ateIt, setAteIt] = useState<Record<string, boolean>>({});
  const save = useMutation({
    mutationFn: () =>
      api("/api/ratings", {
        method: "POST",
        json: {
          recipeId: result.recipeId,
          cookedOn: result.cookedOn,
          ratings: Object.entries(scores).map(([memberId, score]) => ({
            memberId,
            score,
            ateIt: ateIt[memberId],
          })),
        },
      }),
    onSuccess: onDone,
  });

  const RATING_ICONS = [
    { s: 1, Icon: ThumbsDown },
    { s: 3, Icon: Meh },
    { s: 5, Icon: ThumbsUp },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="sheet w-full max-w-lg p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <h3 className="text-lg font-bold tracking-tight">How was it?</h3>
        <p className="text-sm text-soft">
          One tap each — this teaches the planner.
        </p>
        <div className="mt-4 space-y-4">
          {result.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between">
              <span className="font-medium">{m.name}</span>
              <div className="flex items-center gap-2">
                {m.isChild && (
                  <button
                    onClick={() => setAteIt((s) => ({ ...s, [m.id]: !s[m.id] }))}
                    className={`chip font-semibold ${
                      ateIt[m.id]
                        ? "bg-good-soft text-good"
                        : "bg-surface/60 text-faint"
                    }`}
                  >
                    ate it {ateIt[m.id] ? "✓" : "?"}
                  </button>
                )}
                {RATING_ICONS.map(({ s, Icon }) => (
                  <button
                    key={s}
                    onClick={() => setScores((sc) => ({ ...sc, [m.id]: s }))}
                    className={`rounded-full p-2.5 transition ${
                      scores[m.id] === s
                        ? "bg-accent-soft text-accent-deep"
                        : "bg-surface/60 text-faint"
                    }`}
                  >
                    <Icon size={20} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onDone} className="btn-secondary flex-1 py-3">
            Skip
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={Object.keys(scores).length === 0 || save.isPending}
            className="btn-primary flex-1 py-3 disabled:opacity-50"
          >
            Save ratings
          </button>
        </div>
      </div>
    </div>
  );
}
