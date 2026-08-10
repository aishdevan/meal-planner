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
  Replace,
  Search,
  Soup,
  Star,
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
  const [changing, setChanging] = useState<PlanEntry | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["plan", weekStart],
    queryFn: () => api<PlanResponse>(`/api/plan?weekStart=${weekStart}`),
  });
  const { data: recipesData } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => api<{ recipes: Recipe[] }>("/api/recipes"),
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
            onChange={() => setChanging(entry)}
            cooking={cook.isPending}
          />
        );
      })}

      {rateFor && <RateSheet result={rateFor} onDone={() => setRateFor(null)} />}
      {changing && (
        <ChangeMealSheet
          entry={changing}
          recipes={recipesData?.recipes ?? []}
          onClose={() => setChanging(null)}
        />
      )}
    </div>
  );
}

function MealCard({
  entry,
  recipe,
  open,
  onToggle,
  onCooked,
  onChange,
  cooking,
}: {
  entry: PlanEntry;
  recipe: Recipe;
  open: boolean;
  onToggle: () => void;
  onCooked: () => void;
  onChange: () => void;
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
            <div className="mt-5 space-y-2">
              <button
                onClick={onCooked}
                disabled={cooking}
                className="btn-primary w-full py-3.5 text-lg disabled:opacity-50"
              >
                {cooking ? "Saving…" : "Mark cooked"}
              </button>
              <button
                onClick={onChange}
                className="btn-secondary flex w-full items-center justify-center gap-2 py-3 text-sm"
              >
                <Replace size={15} /> Made something else?
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** "I made something else" — swap today's slot to a different recipe. Favorites
 *  first, searchable, and school-lunch stays nut-free + no-reheat. */
function ChangeMealSheet({
  entry,
  recipes,
  onClose,
}: {
  entry: PlanEntry;
  recipes: Recipe[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const patch = useMutation({
    mutationFn: (recipeId: string) =>
      api(`/api/plan/entry/${entry.id}`, {
        method: "PATCH",
        json: { recipeId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["grocery"] });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const isSchoolLunch = entry.slot === "school_lunch";
  const needle = q.trim().toLowerCase();
  const options = recipes
    .filter((r) => r.id !== entry.recipeId)
    .filter((r) => r.mealTypes.includes(entry.slot))
    .filter((r) => !isSchoolLunch || (r.isNutFree && r.noReheatOk))
    .filter((r) => !needle || r.title.toLowerCase().includes(needle))
    .sort((a, b) =>
      a.isFavorite === b.isFavorite
        ? a.title.localeCompare(b.title)
        : a.isFavorite
          ? -1
          : 1,
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="sheet flex max-h-[85vh] w-full max-w-lg flex-col p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-deep">
          {SLOT_LABELS[entry.slot]}
        </div>
        <h3 className="mt-1 text-xl font-bold tracking-tight">
          What did you make instead?
        </h3>
        <p className="mt-1 text-sm text-soft">
          Swaps today&apos;s plan and updates the grocery list.
          {isSchoolLunch && " Nut-free & no-reheat only."}
        </p>
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-surface/60 px-3.5 py-2.5">
          <Search size={15} className="shrink-0 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your meals…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </div>

        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
          {options.map((r) => (
            <button
              key={r.id}
              onClick={() => patch.mutate(r.id)}
              disabled={patch.isPending}
              className="w-full rounded-2xl border border-line bg-surface/60 px-3.5 py-2.5 text-left transition active:scale-[.99] disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{r.title}</span>
                {r.isFavorite && (
                  <Star size={13} className="shrink-0 fill-accent text-accent" />
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-soft">
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} /> {r.totalTimeMinutes}min
                </span>
                <span className="inline-flex items-center gap-1">
                  <Dumbbell size={11} /> {r.proteinGBase}
                  {r.proteinGWithAddon ? `–${r.proteinGWithAddon}` : ""}g
                </span>
              </div>
            </button>
          ))}
          {options.length === 0 && (
            <p className="py-6 text-center text-sm text-faint">
              No matching meals. Add it from the Recipes tab, then pick it here.
            </p>
          )}
        </div>
      </div>
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
