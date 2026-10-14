import { Link } from "react-router-dom";
import { Coins, MapPin } from "lucide-react";
import type { Item } from "@/lib/types";
import { eur } from "@/lib/credits";

export function CreditBadge({ credits, testid }: { credits: number; testid?: string }) {
  return (
    <span
      data-testid={testid}
      className="inline-flex items-center gap-1 rounded-full border-2 border-slate-900 bg-amber-300 px-2.5 py-0.5 text-xs font-extrabold text-slate-900"
    >
      <Coins className="size-3.5" /> {credits} {credits === 1 ? "credit" : "credits"}
    </span>
  );
}

export default function ItemCard({ item, index = 0 }: { item: Item; index?: number }) {
  return (
    <Link
      to={`/items/${item.id}`}
      data-testid={`item-card-${item.id}`}
      className="brutal brutal-hover group block animate-pop-in overflow-hidden rounded-2xl bg-white"
      style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b-2 border-slate-900 bg-slate-100">
        <img
          src={item.image_url}
          alt={item.title}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3">
          <CreditBadge credits={item.credit_cost} testid={`item-card-credits-${item.id}`} />
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-slate-800 backdrop-blur">
          {item.condition}
        </span>
      </div>
      <div className="space-y-1.5 p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">{item.category}</p>
        <h3 className="line-clamp-1 text-lg font-bold text-slate-900" data-testid={`item-card-title-${item.id}`}>
          {item.title}
        </h3>
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span className="font-mono text-xs">est. {eur(item.value_eur)}</span>
          <span className="inline-flex items-center gap-1 text-xs">
            <MapPin className="size-3.5" /> {item.location}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ItemCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white">
      <div className="aspect-[4/3] animate-pulse bg-slate-100" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}
