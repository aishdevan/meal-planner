"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { PantryItem } from "@/lib/types";
import { STORE_LABELS } from "@/lib/types";

const NEXT_STATE: Record<string, "have" | "low" | "out"> = {
  have: "low",
  low: "out",
  out: "have",
};
const STATE_STYLE: Record<string, string> = {
  have: "bg-good-soft text-good",
  low: "bg-accent-soft text-accent-deep",
  out: "bg-bad-soft text-bad",
};

export default function PantryPage() {
  const [search, setSearch] = useState("");
  const [newItem, setNewItem] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["pantry"],
    queryFn: () => api<{ items: PantryItem[] }>("/api/pantry"),
  });

  const cycle = useMutation({
    mutationFn: (item: PantryItem) =>
      api(`/api/pantry/${item.id}`, {
        method: "PATCH",
        json: { state: NEXT_STATE[item.state] },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pantry"] }),
  });
  const add = useMutation({
    mutationFn: () =>
      api("/api/pantry", { method: "POST", json: { name: newItem } }),
    onSuccess: () => {
      setNewItem("");
      qc.invalidateQueries({ queryKey: ["pantry"] });
    },
  });

  const items = (data?.items ?? [])
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const grouped = new Map<string, PantryItem[]>();
  for (const item of items) {
    const key = `${STORE_LABELS[item.store]} · ${item.category}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  const lowOut = (data?.items ?? []).filter((i) => i.state !== "have").length;

  return (
    <div className="space-y-4">
      <header className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Pantry</h1>
        <p className="text-sm text-soft">
          Tap the chip to cycle have → low → out.
          {lowOut > 0 && ` ${lowOut} running low or out.`}
        </p>
      </header>

      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pantry…"
          className="input w-full pl-9"
        />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newItem.trim()) add.mutate();
        }}
        className="flex gap-2"
      >
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add pantry item…"
          className="input min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={!newItem.trim()}
          className="btn-primary px-4 disabled:opacity-40"
        >
          <Plus size={18} />
        </button>
      </form>

      {isLoading && <p className="text-faint">Loading…</p>}

      {[...grouped.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, groupItems]) => (
          <div key={group}>
            <div className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
              {group}
            </div>
            <div className="card overflow-hidden">
              {groupItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-line px-3.5 py-2.5 last:border-0"
                >
                  <span className="text-sm">
                    {item.name}
                    {item.staple && (
                      <span className="ml-1.5 text-[10px] text-faint">
                        staple
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => cycle.mutate(item)}
                    className={`chip font-semibold ${STATE_STYLE[item.state]}`}
                  >
                    {item.state}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
