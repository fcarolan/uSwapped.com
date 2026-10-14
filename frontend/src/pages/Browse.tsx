import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api";
import { CATEGORIES, type Item } from "@/lib/types";
import ItemCard, { ItemCardSkeleton } from "@/components/ItemCard";
import CreditCalculator from "@/components/CreditCalculator";
import { cn } from "@/lib/utils";

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const q = params.get("q") ?? "";
  const [text, setText] = useState(q);

  const { data, isPending, isError } = useQuery({
    queryKey: ["items", q, category],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (category) sp.set("category", category);
      const qs = sp.toString();
      return apiGet<Item[]>(`/items${qs ? `?${qs}` : ""}`);
    },
  });
  const items = isError ? [] : (data ?? []);

  const update = (next: { q?: string; category?: string }) => {
    const sp = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    setParams(sp);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl" data-testid="browse-title">
        Find your next swap
      </h1>
      <form
        className="mt-6 flex max-w-2xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: text.trim() });
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            data-testid="browse-search-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search cameras, vinyl, Dublin…"
            className="h-12 rounded-full border-2 border-slate-900 bg-white pl-10"
          />
        </div>
        <button
          type="submit"
          data-testid="browse-search-button"
          className="brutal brutal-hover rounded-full bg-slate-900 px-6 text-sm font-bold text-white"
        >
          Search
        </button>
      </form>

      <div className="mt-5 flex flex-wrap gap-2" data-testid="browse-category-filters">
        {["", ...CATEGORIES].map((c) => (
          <button
            key={c || "all"}
            type="button"
            data-testid={`category-pill-${c ? c.toLowerCase().replace(/[^a-z]+/g, "-") : "all"}`}
            onClick={() => update({ category: c })}
            className={cn(
              "rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-[background-color,transform] duration-150 active:scale-95",
              category === c ? "border-slate-900 bg-emerald-400 text-slate-900" : "border-slate-300 bg-white text-slate-700 hover:border-slate-900",
            )}
          >
            {c || "All"}
          </button>
        ))}
      </div>

      {q && (
        <button
          type="button"
          onClick={() => {
            setText("");
            update({ q: "" });
          }}
          data-testid="browse-clear-search"
          className="mt-4 inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold"
        >
          "{q}" <X className="size-3" />
        </button>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <p className="mb-4 text-sm text-slate-600" data-testid="browse-result-count">
            {isPending ? "Loading…" : `${items.length} item${items.length === 1 ? "" : "s"} up for swaps`}
          </p>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {isPending && Array.from({ length: 6 }).map((_, i) => <ItemCardSkeleton key={i} />)}
            {items.map((it, i) => <ItemCard key={it.id} item={it} index={i} />)}
          </div>
          {!isPending && items.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center" data-testid="browse-empty">
              <p className="font-heading text-xl font-bold">Nothing here yet</p>
              <p className="mt-1 text-sm text-slate-600">Try another category — or be the first to list something!</p>
            </div>
          )}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CreditCalculator />
        </aside>
      </div>
    </div>
  );
}
