"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Backpack,
  Bookmark as BookmarkIcon,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock,
  Drumstick,
  Dumbbell,
  Flame,
  Hourglass,
  Luggage,
  Mic,
  Palmtree,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShoppingCart,
  Soup,
  Sparkles,
  Star,
  ThumbsDown,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { addDays, mondayOf, todayString, weekDates } from "@/lib/dates";
import type {
  Bookmark,
  CoverageItem,
  CoverageResponse,
  Member,
  PlanEntry,
  PlanResponse,
  Recipe,
} from "@/lib/types";
import { SLOT_LABELS, SLOT_ORDER } from "@/lib/types";
import type { CommandAssignment, CommandProposal } from "@/lib/schemas";
import { RecipeBadges } from "@/components/RecipeView";

type EnrichedAssignment = CommandAssignment & {
  matched_title: string | null;
  replaces: { title: string; cooked: boolean } | null;
};
type EnrichedProposal = Omit<CommandProposal, "assignments"> & {
  assignments: EnrichedAssignment[];
};

export default function WeekPage() {
  const today = todayString();
  const [weekStart, setWeekStart] = useState(mondayOf(today));
  const qc = useQueryClient();
  const [selected, setSelected] = useState<{
    entry: PlanEntry;
    recipe: Recipe;
  } | null>(null);
  const [showAway, setShowAway] = useState(false);
  const [showLeftovers, setShowLeftovers] = useState(false);
  const [addingFav, setAddingFav] = useState<Recipe | null>(null);
  const [addingToSlot, setAddingToSlot] = useState<{
    date: string;
    slot: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["plan", weekStart],
    queryFn: () => api<PlanResponse>(`/api/plan?weekStart=${weekStart}`),
  });
  const { data: recipesData } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => api<{ recipes: Recipe[] }>("/api/recipes"),
  });
  const favorites = (recipesData?.recipes ?? []).filter((r) => r.isFavorite);
  const { data: bookmarksData } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => api<{ bookmarks: Bookmark[] }>("/api/bookmarks"),
  });
  const pendingBookmarks = (bookmarksData?.bookmarks ?? []).filter(
    (b) => b.status === "saved",
  ).length;

  const generate = useMutation({
    mutationFn: (dates?: string[]) =>
      api("/api/plan/generate", { method: "POST", json: { weekStart, dates } }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["grocery"] });
      qc.invalidateQueries({ queryKey: ["coverage"] });
    },
    onError: (e) => setError(e.message),
  });

  const recipeById = new Map((data?.recipes ?? []).map((r) => [r.id, r]));
  const entriesFor = (date: string, slot: string) =>
    (data?.entries ?? [])
      .filter((e) => e.date === date && e.slot === slot)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  const hasAnyPlan = (data?.entries.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pt-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Week</h1>
          <div className="mt-0.5 flex items-center gap-1 text-sm text-soft">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="rounded-full p-1 active:bg-accent-soft"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="tabular-nums">
              {weekStart} → {addDays(weekStart, 6)}
            </span>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="rounded-full p-1 active:bg-accent-soft"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowAway(true)}
          className="btn-secondary flex items-center gap-1.5 px-3.5 py-2 text-sm"
        >
          <Luggage size={15} /> Mark away
        </button>
      </header>

      {pendingBookmarks > 0 && (
        <Link
          href="/bookmarks"
          className="card flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-terra"
        >
          <BookmarkIcon size={16} />
          {pendingBookmarks} saved link{pendingBookmarks > 1 ? "s" : ""} waiting —
          turn them into recipes →
        </Link>
      )}

      <CommandBar weekStart={weekStart} />

      <FavoritesQuickAdd favorites={favorites} onPick={setAddingFav} />

      <button
        onClick={() => setShowLeftovers(true)}
        className="btn-secondary flex w-full items-center justify-center gap-2 py-2.5 text-sm text-terra"
      >
        <Soup size={16} /> Log weekend leftovers
      </button>

      <button
        onClick={() => generate.mutate(undefined)}
        disabled={generate.isPending}
        className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-lg disabled:opacity-60"
      >
        <Sparkles size={20} />
        {generate.isPending
          ? "Planning your week…"
          : hasAnyPlan
            ? "Regenerate week"
            : "Generate week"}
      </button>
      {error && (
        <p className="rounded-2xl bg-bad-soft px-4 py-2.5 text-sm text-bad">
          {error}
        </p>
      )}

      {hasAnyPlan && <CoverageCard weekStart={weekStart} />}

      {isLoading && <p className="text-faint">Loading…</p>}

      <div className="space-y-3">
        {(data?.dates ?? []).map((date) => {
          const away = data?.familyAwayDates.includes(date);
          const dayName = new Date(date + "T12:00:00").toLocaleDateString(
            undefined,
            { weekday: "short", month: "short", day: "numeric" },
          );
          return (
            <div
              key={date}
              className={`card p-3.5 ${
                date === today ? "ring-1 ring-accent/60" : ""
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold tracking-tight">
                  {dayName}
                  {date === today && (
                    <span className="chip ml-2 bg-accent-soft font-bold uppercase tracking-wider text-accent-deep">
                      today
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-faint">
                  {data?.aishAwayDates.includes(date) && !away && "Aish away · "}
                  {data?.rahulAwayDates.includes(date) && !away && "Rahul away · "}
                  {data?.elaiNoSchoolDates.includes(date) && !away && "no school"}
                </span>
              </div>
              {away ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-accent-soft py-3.5 text-sm font-medium text-accent-deep">
                  <Palmtree size={16} /> Away
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {SLOT_ORDER.map((slot) => {
                    const slotEntries = entriesFor(date, slot);
                    if (slotEntries.length === 0) {
                      return (
                        <button
                          key={slot}
                          onClick={() => setAddingToSlot({ date, slot })}
                          className="flex items-center gap-1 rounded-2xl border border-dashed border-line px-2.5 py-2 text-left text-[10px] uppercase tracking-wider text-faint transition active:bg-accent-soft"
                        >
                          {SLOT_LABELS[slot]}
                          <Plus size={11} className="text-accent" />
                        </button>
                      );
                    }
                    return (
                      <div
                        key={slot}
                        className="rounded-2xl border border-line bg-surface/60 px-2.5 py-2"
                      >
                        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-faint">
                          {SLOT_LABELS[slot]}
                        </div>
                        <div className="mt-0.5 space-y-1">
                          {slotEntries.map((entry) => {
                            const recipe = recipeById.get(entry.recipeId);
                            if (!recipe) return null;
                            return (
                              <button
                                key={entry.id}
                                onClick={() => setSelected({ entry, recipe })}
                                className={`flex w-full items-start gap-1 rounded-lg px-1.5 py-1 text-left transition active:scale-[.98] ${
                                  entry.status === "cooked"
                                    ? "bg-good-soft"
                                    : entry.status === "leftover"
                                      ? "bg-terra-soft"
                                      : entry.status === "skipped"
                                        ? "opacity-50"
                                        : ""
                                }`}
                              >
                                {entry.status === "cooked" && (
                                  <Check size={11} className="mt-0.5 shrink-0 text-good" />
                                )}
                                {entry.status === "leftover" && (
                                  <Soup size={11} className="mt-0.5 shrink-0 text-terra" />
                                )}
                                <span className="line-clamp-2 text-xs font-medium leading-snug">
                                  {recipe.title}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setAddingToSlot({ date, slot })}
                          className="mt-1 flex items-center gap-0.5 px-1.5 text-[10px] font-semibold text-accent-deep"
                        >
                          <Plus size={10} /> dish
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected && (
        <EntrySheet
          entry={selected.entry}
          recipe={selected.recipe}
          onClose={() => setSelected(null)}
        />
      )}
      {showAway && (
        <MarkAwaySheet
          weekStart={weekStart}
          hasPlan={hasAnyPlan}
          onClose={() => setShowAway(false)}
          onReadjust={(dates) => generate.mutate(dates)}
        />
      )}
      {addingFav && (
        <FavoriteAddSheet
          recipe={addingFav}
          weekStart={weekStart}
          familyAwayDates={data?.familyAwayDates ?? []}
          rahulAwayDates={data?.rahulAwayDates ?? []}
          onClose={() => setAddingFav(null)}
        />
      )}
      {showLeftovers && (
        <LeftoversSheet
          weekStart={weekStart}
          recipes={recipesData?.recipes ?? []}
          onClose={() => setShowLeftovers(false)}
        />
      )}
      {addingToSlot && (
        <AddDishSheet
          date={addingToSlot.date}
          slot={addingToSlot.slot}
          recipes={recipesData?.recipes ?? []}
          existingRecipeIds={entriesFor(
            addingToSlot.date,
            addingToSlot.slot,
          ).map((e) => e.recipeId)}
          onClose={() => setAddingToSlot(null)}
        />
      )}
    </div>
  );
}

/** Add another dish to a slot on the Week grid (a slot can hold several). */
function AddDishSheet({
  date,
  slot,
  recipes,
  existingRecipeIds,
  onClose,
}: {
  date: string;
  slot: string;
  recipes: Recipe[];
  existingRecipeIds: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const already = new Set(existingRecipeIds);

  const add = useMutation({
    mutationFn: (recipeId: string) =>
      api("/api/plan/entry", {
        method: "POST",
        json: { date, slot, recipeId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["grocery"] });
      qc.invalidateQueries({ queryKey: ["coverage"] });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const isSchoolLunch = slot === "school_lunch";
  const needle = q.trim().toLowerCase();
  const options = recipes
    .filter((r) => !already.has(r.id))
    .filter((r) => r.mealTypes.includes(slot))
    .filter((r) => !isSchoolLunch || (r.isNutFree && r.noReheatOk))
    .filter((r) => !needle || r.title.toLowerCase().includes(needle))
    .sort((a, b) =>
      a.isFavorite === b.isFavorite
        ? a.title.localeCompare(b.title)
        : a.isFavorite
          ? -1
          : 1,
    );

  const dayLabel = new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

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
          {dayLabel} · {SLOT_LABELS[slot]}
        </div>
        <h3 className="mt-1 text-xl font-bold tracking-tight">Add a dish</h3>
        <p className="mt-1 text-sm text-soft">
          Adds alongside what&apos;s already in this meal.
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
              onClick={() => add.mutate(r.id)}
              disabled={add.isPending}
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
              Nothing else fits this slot. Add it from the Recipes tab first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** After a plan exists, confirm every planned dish's main items are either at
 *  home or on the grocery list — and offer to add the ones that aren't. */
function CoverageCard({ weekStart }: { weekStart: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["coverage", weekStart],
    queryFn: () =>
      api<CoverageResponse>(`/api/plan/coverage?weekStart=${weekStart}`),
  });

  const addMissing = useMutation({
    mutationFn: async (items: CoverageItem[]) => {
      for (const it of items) {
        await api("/api/grocery", {
          method: "POST",
          json: {
            name: it.name,
            pantryKey: it.pantryKey,
            store: it.store,
            category: it.category,
            weekStart,
          },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coverage"] });
      qc.invalidateQueries({ queryKey: ["grocery"] });
    },
  });

  if (!data) return null;
  const uncovered = data.items.filter((i) => i.status === "uncovered");
  const needsAttention = uncovered.length > 0 || data.recipesMissingInfo.length > 0;

  const summary =
    data.onList + data.atHome === 0
      ? "No fresh items needed — the menu runs on staples."
      : `${data.onList} to buy · ${data.atHome} already at home`;

  if (!needsAttention) {
    return (
      <div className="card flex items-center gap-3 p-4">
        <ClipboardCheck size={20} className="shrink-0 text-good" />
        <div>
          <p className="text-sm font-bold">Everything on the menu is covered</p>
          <p className="mt-0.5 text-xs text-soft">{summary}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <CircleAlert size={18} className="shrink-0 text-terra" />
        <p className="text-sm font-bold">
          {uncovered.length > 0
            ? `${uncovered.length} main item${uncovered.length > 1 ? "s" : ""} not on your list yet`
            : "Some dishes need a coverage check"}
        </p>
      </div>

      {uncovered.length > 0 && (
        <ul className="space-y-1.5">
          {uncovered.map((it) => (
            <li key={it.pantryKey} className="flex items-baseline gap-2 text-sm">
              <ShoppingCart size={13} className="translate-y-0.5 shrink-0 text-faint" />
              <span className="font-medium">{it.name}</span>
              <span className="text-xs text-faint">
                for {it.recipeTitles.join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {data.recipesMissingInfo.length > 0 && (
        <p className="text-xs text-soft">
          No ingredient info for {data.recipesMissingInfo.join(", ")} — double-check
          you have what you need.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-soft">{summary}</span>
        {uncovered.length > 0 && (
          <button
            onClick={() => addMissing.mutate(uncovered)}
            disabled={addMissing.isPending}
            className="btn-primary flex items-center gap-1.5 px-3.5 py-2 text-sm disabled:opacity-60"
          >
            <Plus size={15} />
            {addMissing.isPending
              ? "Adding…"
              : `Add ${uncovered.length} to grocery list`}
          </button>
        )}
      </div>
    </div>
  );
}

function LeftoversSheet({
  weekStart,
  recipes,
  onClose,
}: {
  weekStart: string;
  recipes: Recipe[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const dates = weekDates(weekStart);
  const [search, setSearch] = useState("");
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [slot, setSlot] = useState<string>("dinner");
  // Default: carries over to Monday (the start of the viewed week).
  const [days, setDays] = useState<Set<string>>(new Set([dates[0]]));
  const [error, setError] = useState<string | null>(null);

  const matches = recipes
    .filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
    .sort(
      (a, b) =>
        Number(b.isFavorite) - Number(a.isFavorite) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, search ? 20 : 8);
  const selectedRecipe = recipes.find((r) => r.id === recipeId);

  const toggleDay = (d: string) =>
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  const save = useMutation({
    mutationFn: () =>
      api("/api/plan/leftovers", {
        method: "POST",
        json: {
          recipeId,
          slots: [...days].map((date) => ({ date, slot })),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["grocery"] });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const dayLabel = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
    });
  const SLOTS = ["breakfast", "lunch", "dinner"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="sheet max-h-[88vh] w-full max-w-lg overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Soup size={20} className="text-terra" /> Log weekend leftovers
        </h3>
        <p className="mt-1 text-sm text-soft">
          Carry a batch-cook into the week. Those meals are marked as leftovers —
          skipped for the grocery list and left out of auto-planning.
        </p>

        {!recipeId ? (
          <div className="mt-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              placeholder="Which dish did you make?"
              className="input w-full"
            />
            <div className="mt-2 space-y-1.5">
              {matches.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRecipeId(r.id)}
                  className="flex w-full items-center gap-2 rounded-2xl border border-line bg-surface/60 px-3.5 py-2.5 text-left text-sm active:scale-[.99]"
                >
                  {r.isFavorite && (
                    <Star size={12} className="shrink-0 text-accent" fill="currentColor" />
                  )}
                  {r.title}
                </button>
              ))}
              {matches.length === 0 && (
                <p className="text-sm text-faint">
                  No match. Add it in the Recipes tab first, then log it here.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-terra-soft px-3.5 py-2.5">
              <span className="text-sm font-semibold text-terra">
                {selectedRecipe?.title}
              </span>
              <button
                onClick={() => setRecipeId(null)}
                className="text-xs font-semibold text-terra underline"
              >
                change
              </button>
            </div>

            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-soft">
                Which meal?
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {SLOTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      slot === s
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line bg-surface/60 text-soft"
                    }`}
                  >
                    {SLOT_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-soft">
                Which days? (Monday by default)
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {dates.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleDay(d)}
                    className={`rounded-2xl border py-2 text-xs font-medium transition ${
                      days.has(d)
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line bg-surface/60 text-soft"
                    }`}
                  >
                    {dayLabel(d)}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-bad">{error}</p>}

            <div className="mt-5 flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1 py-3">
                Cancel
              </button>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending || days.size === 0}
                className="btn-primary flex-1 py-3 disabled:opacity-50"
              >
                {save.isPending
                  ? "Saving…"
                  : `Log for ${days.size} day${days.size === 1 ? "" : "s"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FavoritesQuickAdd({
  favorites,
  onPick,
}: {
  favorites: Recipe[];
  onPick: (recipe: Recipe) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 pl-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-soft">
        <Star size={12} className="text-accent" fill="currentColor" /> Your go-to
        meals
      </div>
      {favorites.length === 0 ? (
        <Link
          href="/recipes"
          className="card block border-dashed px-4 py-3 text-sm text-soft"
        >
          Tap the ★ on dishes in{" "}
          <span className="font-semibold text-accent-deep">Recipes</span> to build
          your go-to list — then drop them straight onto any day here.
        </Link>
      ) : (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {favorites.map((r) => (
            <button
              key={r.id}
              onClick={() => onPick(r)}
              className="card flex shrink-0 items-center gap-2 px-3 py-2.5 text-left active:scale-[.98]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
                <Plus size={14} />
              </span>
              <span className="min-w-0">
                <span className="block max-w-[9rem] truncate text-sm font-medium leading-tight">
                  {r.title}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-faint">
                  <Clock size={9} /> {r.totalTimeMinutes}min
                  {r.mealTypes.includes("school_lunch") && (
                    <span className="inline-flex items-center gap-0.5 text-accent-deep">
                      <Backpack size={9} /> lunchbox
                    </span>
                  )}
                  {r.needsPrep && (
                    <span className="inline-flex items-center gap-0.5 text-terra">
                      <Hourglass size={9} /> prep
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FavoriteAddSheet({
  recipe,
  weekStart,
  familyAwayDates,
  rahulAwayDates,
  onClose,
}: {
  recipe: Recipe;
  weekStart: string;
  familyAwayDates: string[];
  rahulAwayDates: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const dates = weekDates(weekStart);
  const validSlots = SLOT_ORDER.filter(
    (s) =>
      recipe.mealTypes.includes(s) &&
      (s !== "school_lunch" || (recipe.isNutFree && recipe.noReheatOk)),
  );

  const today = todayString();
  const firstOpenDay =
    dates.find((d) => d >= today && !familyAwayDates.includes(d)) ??
    dates.find((d) => !familyAwayDates.includes(d)) ??
    dates[0];
  const [date, setDate] = useState(firstOpenDay);
  const [slot, setSlot] = useState(validSlots[0] ?? "dinner");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => {
      const includeAddon =
        slot === "dinner" &&
        Boolean(recipe.nonvegAddon) &&
        !rahulAwayDates.includes(date);
      const assignment: CommandAssignment = {
        date,
        slot: slot as CommandAssignment["slot"],
        recipe_id: recipe.id,
        new_recipe: null,
        interpreted_as: `${SLOT_LABELS[slot]} → ${recipe.title}`,
        include_addon: includeAddon,
      };
      return api<{ applied: string[]; skipped: string[] }>(
        "/api/plan/command/apply",
        { method: "POST", json: { assignments: [assignment] } },
      );
    },
    onSuccess: (res) => {
      if (res.skipped.length > 0) {
        setError(res.skipped[0]);
        return;
      }
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["grocery"] });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const dayLabel = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
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
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-deep">
          <Star size={11} fill="currentColor" /> Add a favorite
        </div>
        <h3 className="mt-1 text-xl font-bold tracking-tight">{recipe.title}</h3>
        {recipe.needsPrep && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-2xl bg-terra-soft px-3 py-1.5 text-xs font-medium text-terra">
            <Hourglass size={12} /> Soak/prep the night before
          </p>
        )}

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-soft">
            Which day?
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {dates.map((d) => {
              const away = familyAwayDates.includes(d);
              return (
                <button
                  key={d}
                  disabled={away}
                  onClick={() => setDate(d)}
                  className={`rounded-2xl border py-2 text-xs font-medium transition disabled:opacity-30 ${
                    date === d
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line bg-surface/60 text-soft"
                  }`}
                >
                  {away ? "Away" : dayLabel(d)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-soft">
            Which meal?
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {validSlots.map((s) => (
              <button
                key={s}
                onClick={() => setSlot(s)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  slot === s
                    ? "border-accent bg-accent text-on-accent"
                    : "border-line bg-surface/60 text-soft"
                }`}
              >
                {SLOT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-bad">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 py-3">
            Cancel
          </button>
          <button
            onClick={() => add.mutate()}
            disabled={add.isPending || !date || !slot}
            className="btn-primary flex-1 py-3 disabled:opacity-50"
          >
            {add.isPending
              ? "Adding…"
              : `Add to ${dayLabel(date)} ${SLOT_LABELS[slot].toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CommandBar({ weekStart }: { weekStart: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<EnrichedProposal | null>(null);
  const [result, setResult] = useState<{ applied: string[]; skipped: string[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const parse = useMutation({
    mutationFn: () =>
      api<{ proposal: EnrichedProposal }>("/api/plan/command", {
        method: "POST",
        json: { text, weekStart },
      }),
    onSuccess: ({ proposal }) => {
      setError(null);
      setProposal(proposal);
    },
    onError: (e) => setError(e.message),
  });

  const apply = useMutation({
    mutationFn: (assignments: EnrichedAssignment[]) =>
      api<{ applied: string[]; skipped: string[] }>("/api/plan/command/apply", {
        method: "POST",
        json: { assignments },
      }),
    onSuccess: (res) => {
      setProposal(null);
      setText("");
      setResult(res);
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["grocery"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
    onError: (e) => setError(e.message),
  });

  // Apply whatever concrete meals were dictated, then let Claude fill the
  // remaining empty slots — honoring the whole brief as guidance.
  const applyAndFill = useMutation({
    mutationFn: async (p: {
      assignments: EnrichedAssignment[];
      brief: string;
    }) => {
      if (p.assignments.length > 0) {
        await api("/api/plan/command/apply", {
          method: "POST",
          json: { assignments: p.assignments },
        });
      }
      return api("/api/plan/generate", {
        method: "POST",
        json: { weekStart, guidance: p.brief, fillGapsOnly: true },
      });
    },
    onSuccess: () => {
      setProposal(null);
      setText("");
      setResult(null);
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["grocery"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
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
          placeholder="Tell me the plan… “Tuesday dinner rajma”"
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
      <p className="mt-1 pl-1 text-[10px] text-faint">
        Tap the box and dictate with the 🎤 — rattle off as much as you like
        (“Monday chole leftovers, Tuesday pasta, keep breakfasts light”). Then
        set just those, or fill the rest of the week automatically.
      </p>
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
            {proposal.assignments.length === 0 ? (
              <p className="mt-3 text-sm text-soft">
                No specific meal slots in that — but I can still generate the
                week, using what you said as guidance.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {proposal.assignments.map((a, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-line bg-surface/60 px-3.5 py-2.5"
                  >
                    <div className="text-sm font-medium">{a.interpreted_as}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px]">
                      {a.new_recipe && (
                        <span className="chip bg-accent-soft font-semibold text-accent-deep">
                          <Sparkles size={10} /> new recipe:{" "}
                          {a.new_recipe.title}
                        </span>
                      )}
                      {a.replaces && !a.replaces.cooked && (
                        <span className="chip bg-terra-soft text-terra">
                          replaces {a.replaces.title} (kept as alternative)
                        </span>
                      )}
                      {a.replaces?.cooked && (
                        <span className="chip bg-bad-soft text-bad">
                          already cooked — will be skipped
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 space-y-2">
              <button
                onClick={() =>
                  applyAndFill.mutate({
                    assignments: proposal.assignments,
                    brief: text,
                  })
                }
                disabled={apply.isPending || applyAndFill.isPending}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
              >
                <Sparkles size={16} />
                {applyAndFill.isPending
                  ? "Planning your week…"
                  : proposal.assignments.length > 0
                    ? "Apply & fill the rest of the week"
                    : "Generate the week from this"}
              </button>
              {proposal.assignments.length > 0 && (
                <button
                  onClick={() => apply.mutate(proposal.assignments)}
                  disabled={apply.isPending || applyAndFill.isPending}
                  className="btn-secondary w-full py-3 disabled:opacity-50"
                >
                  {apply.isPending
                    ? "Applying…"
                    : `Just apply ${proposal.assignments.length} change${proposal.assignments.length === 1 ? "" : "s"}`}
                </button>
              )}
              <button
                onClick={() => setProposal(null)}
                className="w-full py-2 text-sm text-faint"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EntrySheet({
  entry,
  recipe,
  onClose,
}: {
  entry: PlanEntry;
  recipe: Recipe;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["plan"] });
    qc.invalidateQueries({ queryKey: ["grocery"] });
  };

  const swap = useMutation({
    mutationFn: () =>
      api("/api/plan/swap", {
        method: "POST",
        json: { date: entry.date, slot: entry.slot },
      }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setError(e.message),
  });
  const patch = useMutation({
    mutationFn: (json: Record<string, unknown>) =>
      api(`/api/plan/entry/${entry.id}`, { method: "PATCH", json }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: () =>
      api(`/api/plan/entry/${entry.id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const { data: alts, isLoading: altsLoading } = useQuery({
    queryKey: ["alternatives", entry.id],
    queryFn: () =>
      api<{ alternatives: { recipe: Recipe; wasRejected: boolean }[] }>(
        `/api/plan/entry/${entry.id}/alternatives`,
      ),
    enabled: picking,
    refetchInterval: false,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="sheet max-h-[85vh] w-full max-w-lg overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-deep">
          {entry.date} · {SLOT_LABELS[entry.slot]}
        </div>
        <h3 className="mt-1 text-xl font-bold tracking-tight">{recipe.title}</h3>
        <div className="mt-2.5">
          <RecipeBadges recipe={recipe} />
        </div>
        {entry.why && (
          <p className="mt-2 text-sm italic text-soft">“{entry.why}”</p>
        )}
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}

        {entry.status === "leftover" ? (
          <div className="mt-4 space-y-2">
            <p className="flex items-center gap-1.5 rounded-2xl bg-terra-soft px-3.5 py-2.5 text-sm font-medium text-terra">
              <Soup size={15} /> Carried over as leftovers from a weekend cook.
            </p>
            <Link
              href={`/recipes/${recipe.id}`}
              className="btn-primary block w-full py-3 text-center"
            >
              View full recipe
            </Link>
            <button
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-bad-soft py-3 font-semibold text-bad disabled:opacity-50"
            >
              <Trash2 size={16} />{" "}
              {remove.isPending ? "Removing…" : "Remove leftover"}
            </button>
          </div>
        ) : !picking ? (
          <div className="mt-4 space-y-2">
            <Link
              href={`/recipes/${recipe.id}`}
              className="btn-primary block w-full py-3 text-center"
            >
              View full recipe
            </Link>
            {recipe.nonvegAddon && (
              <button
                onClick={() => patch.mutate({ includeAddon: !entry.includeAddon })}
                className="w-full rounded-2xl border border-terra/25 bg-terra-soft py-3 font-semibold text-terra"
              >
                {entry.includeAddon
                  ? `Skip the ${recipe.nonvegAddon.name}`
                  : `Add ${recipe.nonvegAddon.name} for Rahul & Elai`}
              </button>
            )}
            {recipe.nonvegAddon?.marinateAhead && entry.includeAddon && (
              <p className="flex items-center justify-center gap-1.5 rounded-2xl bg-terra/10 py-2.5 text-sm font-semibold text-terra">
                <Drumstick size={14} /> Marinate the chicken the night before
              </p>
            )}
            <button
              onClick={() => setPicking(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-bad-soft py-3 font-semibold text-bad"
            >
              <ThumbsDown size={16} /> Don&apos;t want this — show alternatives
            </button>
            <button
              onClick={() => swap.mutate()}
              disabled={swap.isPending}
              className="btn-secondary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
            >
              <Sparkles size={16} />
              {swap.isPending ? "Swapping…" : "Surprise-swap"}
            </button>
            {entry.status !== "skipped" ? (
              <button
                onClick={() => patch.mutate({ status: "skipped" })}
                className="w-full py-2.5 text-sm text-faint"
              >
                Skip this meal (eating out / leftovers)
              </button>
            ) : (
              <button
                onClick={() => patch.mutate({ status: "planned" })}
                className="w-full py-2.5 text-sm text-faint"
              >
                Un-skip
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="mb-2.5 text-sm text-soft">
              Alternatives for this {SLOT_LABELS[entry.slot].toLowerCase()}
              {entry.slot === "school_lunch" && " (nut-free & no-reheat only)"} —
              replacing keeps &ldquo;{recipe.title}&rdquo; available here in case
              you change your mind:
            </p>
            {altsLoading && <p className="text-sm text-faint">Loading…</p>}
            <div className="space-y-1.5">
              {(alts?.alternatives ?? []).map(({ recipe: r, wasRejected }) => (
                <button
                  key={r.id}
                  onClick={() => patch.mutate({ recipeId: r.id })}
                  disabled={patch.isPending}
                  className={`w-full rounded-2xl border px-3.5 py-2.5 text-left transition active:scale-[.99] disabled:opacity-50 ${
                    wasRejected
                      ? "border-accent/40 bg-accent-soft"
                      : "border-line bg-surface/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{r.title}</span>
                    {wasRejected && (
                      <span className="chip shrink-0 bg-accent-soft font-semibold text-accent-deep">
                        <RotateCcw size={10} /> previously picked
                      </span>
                    )}
                  </div>
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
                  </div>
                  {r.sourceName && (
                    <div className="mt-1 flex items-center gap-1 truncate text-[10px] text-faint">
                      <BookOpen size={10} className="shrink-0" /> {r.sourceName}
                    </div>
                  )}
                </button>
              ))}
              {!altsLoading && (alts?.alternatives.length ?? 0) === 0 && (
                <p className="text-sm text-faint">
                  No other recipes fit this slot yet — import or add some!
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MarkAwaySheet({
  weekStart,
  hasPlan,
  onClose,
  onReadjust,
}: {
  weekStart: string;
  hasPlan: boolean;
  onClose: () => void;
  onReadjust: (dates: string[]) => void;
}) {
  const qc = useQueryClient();
  const [memberId, setMemberId] = useState<string>("");
  const [startDate, setStartDate] = useState(weekStart);
  const [endDate, setEndDate] = useState(weekStart);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ["members"],
    queryFn: () => api<{ members: Member[] }>("/api/members"),
  });

  const save = useMutation({
    mutationFn: () =>
      api("/api/absences", {
        method: "POST",
        json: {
          memberId: memberId || null,
          startDate,
          endDate,
          type: memberId ? "travel" : "vacation",
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["absences"] });
      setSaved(true);
    },
  });

  const affectedDates = (() => {
    const out: string[] = [];
    for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
      if (d >= weekStart && d <= addDays(weekStart, 6)) out.push(d);
      if (out.length > 14) break;
    }
    return out;
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="sheet w-full max-w-lg p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        {!saved ? (
          <>
            <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Luggage size={20} className="text-accent" /> Mark away
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-soft">
                  Who&apos;s away?
                </label>
                <select
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="input mt-1 w-full"
                >
                  <option value="">Whole family (vacation)</option>
                  {(data?.members ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-soft">
                    From
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input mt-1 w-full"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-soft">
                    To
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input mt-1 w-full"
                  />
                </div>
              </div>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending || endDate < startDate}
                className="btn-primary w-full py-3 disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save absence"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Check size={20} className="text-good" /> Absence saved
            </h3>
            {hasPlan && affectedDates.length > 0 ? (
              <>
                <p className="mt-2 text-sm text-soft">
                  This week already has a plan. Readjust the affected days (
                  {affectedDates.join(", ")})? Cooked meals are kept.
                </p>
                <div className="mt-4 flex gap-3">
                  <button onClick={onClose} className="btn-secondary flex-1 py-3">
                    Leave as-is
                  </button>
                  <button
                    onClick={() => {
                      onReadjust(affectedDates);
                      onClose();
                    }}
                    className="btn-primary flex-1 py-3"
                  >
                    Readjust days
                  </button>
                </div>
              </>
            ) : (
              <button onClick={onClose} className="btn-primary mt-4 w-full py-3">
                Done
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
