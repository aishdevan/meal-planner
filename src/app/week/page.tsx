"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark as BookmarkIcon,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Luggage,
  Palmtree,
  RotateCcw,
  Sparkles,
  ThumbsDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { addDays, mondayOf, todayString } from "@/lib/dates";
import type {
  Bookmark,
  Member,
  PlanEntry,
  PlanResponse,
  Recipe,
} from "@/lib/types";
import { SLOT_LABELS, SLOT_ORDER } from "@/lib/types";
import { RecipeBadges } from "@/components/RecipeView";

export default function WeekPage() {
  const today = todayString();
  const [weekStart, setWeekStart] = useState(mondayOf(today));
  const qc = useQueryClient();
  const [selected, setSelected] = useState<{
    entry: PlanEntry;
    recipe: Recipe;
  } | null>(null);
  const [showAway, setShowAway] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["plan", weekStart],
    queryFn: () => api<PlanResponse>(`/api/plan?weekStart=${weekStart}`),
  });
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
    },
    onError: (e) => setError(e.message),
  });

  const recipeById = new Map((data?.recipes ?? []).map((r) => [r.id, r]));
  const entryFor = (date: string, slot: string) =>
    data?.entries.find((e) => e.date === date && e.slot === slot);
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
                    const entry = entryFor(date, slot);
                    const recipe = entry ? recipeById.get(entry.recipeId) : null;
                    if (!entry || !recipe) {
                      return (
                        <div
                          key={slot}
                          className="rounded-2xl border border-dashed border-line px-2.5 py-2 text-[10px] uppercase tracking-wider text-faint"
                        >
                          {SLOT_LABELS[slot]}
                        </div>
                      );
                    }
                    return (
                      <button
                        key={slot}
                        onClick={() => setSelected({ entry, recipe })}
                        className={`rounded-2xl border border-line px-2.5 py-2 text-left transition active:scale-[.98] ${
                          entry.status === "cooked"
                            ? "bg-good-soft"
                            : entry.status === "skipped"
                              ? "bg-surface/40 opacity-50"
                              : "bg-surface/60"
                        }`}
                      >
                        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-faint">
                          {SLOT_LABELS[slot]}
                          {entry.status === "cooked" && (
                            <Check size={10} className="text-good" />
                          )}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug">
                          {recipe.title}
                        </div>
                      </button>
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

        {!picking ? (
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
