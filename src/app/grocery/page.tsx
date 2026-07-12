"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Carrot,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { addDays, mondayOf, todayString } from "@/lib/dates";
import type { GroceryItem } from "@/lib/types";
import { STORE_LABELS } from "@/lib/types";

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
  const toggle = useMutation({
    mutationFn: (item: GroceryItem) =>
      api(`/api/grocery/${item.id}`, {
        method: "PATCH",
        json: { checked: !item.checked },
      }),
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

      <button
        onClick={() => addStaples.mutate()}
        disabled={addStaples.isPending}
        className="btn-secondary flex items-center gap-1.5 px-3.5 py-2 text-sm"
      >
        <Plus size={15} /> Add low/out staples
      </button>

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
