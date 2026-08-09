"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Carrot,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Plus,
  Repeat,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { addDays, mondayOf, todayString } from "@/lib/dates";
import {
  enqueueToggle,
  flushQueue,
  isNetworkError,
} from "@/lib/offline-queue";
import type { GroceryItem, GroceryRegular } from "@/lib/types";
import { STORE_LABELS } from "@/lib/types";
import { VoiceBar } from "@/components/VoiceBar";

/** Tap-to-create starters shown when the regulars palette is empty. */
const SUGGESTED_REGULARS: {
  name: string;
  store: string;
  category: string;
}[] = [
  { name: "Spinach", store: "whole_foods", category: "produce" },
  { name: "Tomatoes", store: "whole_foods", category: "produce" },
  { name: "Onions", store: "whole_foods", category: "produce" },
  { name: "Cilantro", store: "whole_foods", category: "produce" },
  { name: "Bananas", store: "whole_foods", category: "produce" },
  { name: "Berries", store: "whole_foods", category: "produce" },
  { name: "Milk", store: "whole_foods", category: "dairy" },
  { name: "Yogurt", store: "whole_foods", category: "dairy" },
  { name: "Eggs", store: "whole_foods", category: "dairy" },
  { name: "Paneer", store: "indian_store", category: "dairy" },
  { name: "Bread", store: "whole_foods", category: "bakery" },
];

const STORE_ORDER = ["whole_foods", "farmers_market", "indian_store"];
const STORE_ICONS: Record<string, typeof ShoppingCart> = {
  whole_foods: ShoppingCart,
  farmers_market: Carrot,
  indian_store: Store,
};

export default function GroceryPage() {
  // Weekend shopping is for NEXT week's plan; from Sat onward show next week.
  const today = todayString();
  const dow = new Date().getDay();
  const defaultWeek =
    dow === 6 || dow === 0 ? mondayOf(addDays(today, 7)) : mondayOf(today);
  const [weekStart, setWeekStart] = useState(defaultWeek);
  const [newItem, setNewItem] = useState("");
  const [newStore, setNewStore] = useState("whole_foods");
  const [pendingSync, setPendingSync] = useState(0);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["grocery", weekStart],
    queryFn: () =>
      api<{ items: GroceryItem[] }>(`/api/grocery?weekStart=${weekStart}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["grocery"] });
    qc.invalidateQueries({ queryKey: ["pantry"] });
  };

  // Replay any check-offs made offline (bad store reception) once we're back.
  // flushQueue reports how many are still stuck, which drives the sync chip.
  useEffect(() => {
    const flush = () =>
      flushQueue().then((remaining) => {
        setPendingSync(remaining);
        if (remaining === 0) invalidate();
      });
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useMutation({
    mutationFn: async (item: GroceryItem) => {
      try {
        await api(`/api/grocery/${item.id}`, {
          method: "PATCH",
          json: { checked: !item.checked },
        });
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        // Offline in the store aisle: keep the optimistic tick, queue the sync.
        setPendingSync(enqueueToggle(item.id, !item.checked));
      }
    },
    // Optimistic: flip immediately so check-offs feel instant (and work offline)
    onMutate: async (item) => {
      await qc.cancelQueries({ queryKey: ["grocery", weekStart] });
      qc.setQueryData<{ items: GroceryItem[] }>(
        ["grocery", weekStart],
        (old) =>
          old && {
            items: old.items.map((i) =>
              i.id === item.id ? { ...i, checked: !i.checked } : i,
            ),
          },
      );
    },
    onSuccess: invalidate,
  });
  const addStaples = useMutation({
    mutationFn: () =>
      api<{ added: number }>("/api/grocery/staples", {
        method: "POST",
        json: { weekStart },
      }),
    onSuccess: invalidate,
  });
  const addManual = useMutation({
    mutationFn: () =>
      api("/api/grocery", {
        method: "POST",
        json: { name: newItem, store: newStore, weekStart },
      }),
    onSuccess: () => {
      setNewItem("");
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/grocery/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const items = data?.items ?? [];
  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const byStore = new Map<string, Map<string, GroceryItem[]>>();
  for (const item of unchecked) {
    if (!byStore.has(item.store)) byStore.set(item.store, new Map());
    const cats = byStore.get(item.store)!;
    if (!cats.has(item.category)) cats.set(item.category, []);
    cats.get(item.category)!.push(item);
  }

  return (
    <div className="space-y-4">
      <header className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Grocery</h1>
        <div className="mt-0.5 flex items-center gap-1 text-sm text-soft">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="rounded-full p-1 active:bg-accent-soft"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="tabular-nums">week of {weekStart}</span>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="rounded-full p-1 active:bg-accent-soft"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      <VoiceBar
        placeholder="Tell the list… “got the milk, add bananas”"
        hint="Tap the box, then use the 🎤 on your keyboard — “got the…” checks things off, “add…” puts them on the list."
        parsePath="/api/grocery/command"
        applyPath="/api/grocery/command/apply"
        extra={{ weekStart }}
        emptyMessage="I couldn't turn that into any list changes — try “got the milk and eggs” or “add bananas”."
        onApplied={invalidate}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => addStaples.mutate()}
          disabled={addStaples.isPending}
          className="btn-secondary flex items-center gap-1.5 px-3.5 py-2 text-sm"
        >
          <Plus size={15} /> Add low/out staples
        </button>
        {pendingSync > 0 && (
          <span className="chip bg-accent-soft font-semibold text-accent-deep">
            <CloudOff size={11} /> {pendingSync} to sync
          </span>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newItem.trim()) addManual.mutate();
        }}
        className="flex gap-2"
      >
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add item…"
          className="input min-w-0 flex-1"
        />
        <select
          value={newStore}
          onChange={(e) => setNewStore(e.target.value)}
          className="input px-2"
        >
          {STORE_ORDER.map((s) => (
            <option key={s} value={s}>
              {STORE_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!newItem.trim()}
          className="btn-primary px-4 disabled:opacity-40"
        >
          <Plus size={18} />
        </button>
      </form>

      <MyRegulars weekStart={weekStart} items={items} />

      {isLoading && <p className="text-faint">Loading…</p>}
      {!isLoading && items.length === 0 && (
        <div className="card border-dashed p-8 text-center text-sm text-soft">
          List is empty — generate the week&apos;s plan first, and the list
          builds itself.
        </div>
      )}

      {STORE_ORDER.filter((s) => byStore.has(s)).map((store) => {
        const StoreIcon = STORE_ICONS[store] ?? ShoppingCart;
        return (
          <section key={store}>
            <h2 className="mb-2 mt-4 flex items-center gap-2 text-lg font-bold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
                <StoreIcon size={16} />
              </span>
              {STORE_LABELS[store]}
              <span className="text-sm font-normal text-faint">
                {[...byStore.get(store)!.values()].flat().length} items
              </span>
            </h2>
            {[...byStore.get(store)!.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, catItems]) => (
                <div key={category} className="mb-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                    {category}
                  </div>
                  <div className="card overflow-hidden">
                    {catItems.map((item) => (
                      <GroceryRow
                        key={item.id}
                        item={item}
                        onToggle={() => toggle.mutate(item)}
                        onRemove={() => remove.mutate(item.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </section>
        );
      })}

      {checked.length > 0 && (
        <section className="opacity-60">
          <h2 className="mb-2 mt-4 text-sm font-bold text-soft">
            In the cart ({checked.length})
          </h2>
          <div className="card overflow-hidden">
            {checked.map((item) => (
              <GroceryRow
                key={item.id}
                item={item}
                onToggle={() => toggle.mutate(item)}
                onRemove={() => remove.mutate(item.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GroceryRow({
  item,
  onToggle,
  onRemove,
}: {
  item: GroceryItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center border-b border-line last:border-0">
      <button
        onClick={onToggle}
        className="flex flex-1 items-center gap-3 px-3.5 py-3 text-left"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
            item.checked
              ? "border-accent bg-accent text-on-accent"
              : "border-line"
          }`}
        >
          {item.checked && <Check size={13} strokeWidth={3} />}
        </span>
        <span className={`text-sm ${item.checked ? "line-through" : ""}`}>
          {item.name}
          {item.qtyText && (
            <span className="ml-2 text-xs text-faint">{item.qtyText}</span>
          )}
        </span>
      </button>
      <button onClick={onRemove} className="px-3.5 py-3 text-faint">
        <X size={15} />
      </button>
    </div>
  );
}

/**
 * A reusable "usual buys" palette. Build it once; each week tap the items you
 * need onto that week's list (tap again to drop). Perishables you re-buy
 * often — produce, dairy — without retyping.
 */
function MyRegulars({
  weekStart,
  items,
}: {
  weekStart: string;
  items: GroceryItem[];
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [store, setStore] = useState("whole_foods");
  const keyOf = (n: string) => n.toLowerCase().replace(/\s+/g, "_");

  const { data } = useQuery({
    queryKey: ["regulars"],
    queryFn: () => api<{ regulars: GroceryRegular[] }>("/api/grocery/regulars"),
  });
  const regulars = (data?.regulars ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const savedKeys = new Set(regulars.map((r) => r.pantryKey));
  // Starters you haven't saved yet stay on offer, so tapping one never
  // collapses the rest of the row.
  const suggestions = SUGGESTED_REGULARS.filter(
    (s) => !savedKeys.has(keyOf(s.name)),
  );

  const onListByKey = new Map(items.map((i) => [i.pantryKey, i]));
  const invalidateList = () => qc.invalidateQueries({ queryKey: ["grocery"] });
  const invalidateBoth = () => {
    qc.invalidateQueries({ queryKey: ["grocery"] });
    qc.invalidateQueries({ queryKey: ["regulars"] });
  };

  const addToList = useMutation({
    mutationFn: (r: GroceryRegular) =>
      api("/api/grocery", {
        method: "POST",
        json: {
          name: r.name,
          store: r.store,
          category: r.category,
          pantryKey: r.pantryKey,
          weekStart,
        },
      }),
    onSuccess: invalidateList,
  });
  const removeFromList = useMutation({
    mutationFn: (id: string) => api(`/api/grocery/${id}`, { method: "DELETE" }),
    onSuccess: invalidateList,
  });
  // Tapping a starter both saves it as a regular AND drops it on this week's
  // list, so the result is visible instead of the item just moving rows.
  const quickAdd = useMutation({
    mutationFn: async (s: { name: string; store: string; category: string }) => {
      await api("/api/grocery/regulars", { method: "POST", json: s });
      await api("/api/grocery", {
        method: "POST",
        json: { ...s, pantryKey: keyOf(s.name), weekStart },
      });
    },
    onSuccess: invalidateBoth,
  });
  const createRegular = useMutation({
    // Accepts one name or several separated by commas / new lines, so you can
    // add a whole batch at once. Each still becomes its own chip.
    mutationFn: async (v: { name: string; store: string; category?: string }) => {
      const names = [
        ...new Set(
          v.name
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ];
      for (const name of names) {
        await api("/api/grocery/regulars", {
          method: "POST",
          json: { name, store: v.store, category: v.category },
        });
      }
    },
    onSuccess: () => {
      setName("");
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["regulars"] });
    },
  });
  const deleteRegular = useMutation({
    mutationFn: (id: string) =>
      api(`/api/grocery/regulars/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["regulars"] }),
  });

  const toggle = (r: GroceryRegular) => {
    const on = onListByKey.get(r.pantryKey);
    if (on) removeFromList.mutate(on.id);
    else addToList.mutate(r);
  };

  return (
    <section className="card p-3.5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
          <Repeat size={15} className="text-accent" /> My regulars
        </h2>
        {regulars.length > 0 && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="text-xs font-semibold text-faint"
          >
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-faint">
        Your usual buys, saved so you don&apos;t retype them. Tap one to add it
        to this week&apos;s list; tap again to take it off.
        {editing && " Tap to remove from your regulars."}
      </p>

      {regulars.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {regulars.map((r) => {
            const on = onListByKey.has(r.pantryKey);
            return (
              <button
                key={r.id}
                onClick={() => (editing ? deleteRegular.mutate(r.id) : toggle(r))}
                className={`chip font-medium transition ${
                  editing
                    ? "border border-bad/40 bg-bad-soft text-bad"
                    : on
                      ? "bg-accent text-on-accent"
                      : "border border-line bg-surface/60 text-soft"
                }`}
              >
                {editing ? (
                  <X size={11} />
                ) : on ? (
                  <Check size={11} />
                ) : (
                  <Plus size={11} />
                )}
                {r.name}
              </button>
            );
          })}
        </div>
      )}

      {!adding && !editing && suggestions.length > 0 && (
        <div className="mt-2.5">
          <p className="mb-1.5 text-[11px] text-faint">
            {regulars.length === 0
              ? "Tap the ones you usually buy to start your list:"
              : "Add more to your regulars:"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.name}
                onClick={() => quickAdd.mutate(s)}
                className="chip border border-dashed border-line bg-surface/40 text-faint"
              >
                <Plus size={11} /> {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createRegular.mutate({ name, store });
          }}
          className="mt-2.5 flex gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="e.g. Spinach, Tomatoes, Milk"
            className="input min-w-0 flex-1 py-2 text-sm"
          />
          <select
            value={store}
            onChange={(e) => setStore(e.target.value)}
            className="input px-2 py-2 text-sm"
          >
            {STORE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STORE_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!name.trim() || createRegular.isPending}
            className="btn-primary px-3 disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2.5 text-xs font-semibold text-accent-deep"
        >
          ＋ New regular
        </button>
      )}
    </section>
  );
}
