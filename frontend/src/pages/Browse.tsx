import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellPlus, MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api";
import { CATEGORIES, type Category, type Item, type SavedSearch, type SavedSearchCreate } from "@/lib/types";
import { errorMessage, useMe } from "@/lib/hooks";
import ItemCard, { ItemCardSkeleton } from "@/components/ItemCard";
import FeeCalculator from "@/components/FeeCalculator";
import { cn } from "@/lib/utils";

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const q = params.get("q") ?? "";
  const location = params.get("location") ?? "";
  const [text, setText] = useState(q);
  const [where, setWhere] = useState(location);
  const qc = useQueryClient();
  const { data: me } = useMe();
  const save = useMutation({
    mutationFn: (body: SavedSearchCreate) => apiPost<SavedSearch>("/saved-searches", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
      toast.success("Search saved 🔔 We'll alert you when a match is listed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const hasFilters = !!(q || category || location);

  const { data, isPending, isError } = useQuery({
    queryKey: ["items", q, category, location],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      if (category) sp.set("category", category);
      if (location) sp.set("location", location);
      const qs = sp.toString();
      return apiGet<Item[]>(`/items${qs ? `?${qs}` : ""}`);
    },
  });
  const items = isError ? [] : (data ?? []);

  const update = (next: { q?: string; category?: string; location?: string }) => {
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
        className="mt-6 flex max-w-3xl flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: text.trim(), location: where.trim() });
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            data-testid="browse-search-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search cameras, vinyl, bikes…"
            className="h-12 rounded-full border-2 border-slate-900 bg-white pl-10"
          />
        </div>
        <div className="relative sm:w-52">
          <MapPin className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            data-testid="browse-location-input"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder="Anywhere"
            className="h-12 rounded-full border-2 border-slate-900 bg-white pl-10"
          />
        </div>
        <button
          type="submit"
          data-testid="browse-search-button"
          className="brutal brutal-hover h-12 rounded-full bg-slate-900 px-6 text-sm font-bold text-white"
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {q && (
          <button
            type="button"
            onClick={() => {
              setText("");
              update({ q: "" });
            }}
            data-testid="browse-clear-search"
            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold"
          >
            "{q}" <X className="size-3" />
          </button>
        )}
        {location && (
          <button
            type="button"
            onClick={() => {
              setWhere("");
              update({ location: "" });
            }}
            data-testid="browse-clear-location"
            className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold"
          >
            <MapPin className="size-3" /> {location} <X className="size-3" />
          </button>
        )}
        {hasFilters && (
          <button
            type="button"
            data-testid="browse-save-search-button"
            disabled={save.isPending}
            onClick={() => {
              if (!me) {
                toast("Sign in to save searches and get alerts", { action: { label: "Sign in", onClick: () => window.location.assign("/login?next=/browse") } });
                return;
              }
              save.mutate({ q, category: (category || null) as Category | null, location });
            }}
            className="brutal brutal-hover inline-flex items-center gap-1.5 rounded-full bg-pink-200 px-3.5 py-1.5 text-xs font-extrabold text-slate-900"
          >
            <BellPlus className="size-3.5" /> Save search &amp; get alerts
          </button>
        )}
      </div>

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
          <FeeCalculator />
        </aside>
      </div>
    </div>
  );
}
