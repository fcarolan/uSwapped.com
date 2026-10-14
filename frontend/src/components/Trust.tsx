import { BadgeCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Mirrors backend/lib/search.py is_trusted()
export const isTrusted = (avg: number | null, count: number) => avg !== null && count >= 3 && avg >= 4.5;

export function Stars({ value, size = "size-3.5", testid }: { value: number; size?: string; testid?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" data-testid={testid} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= Math.round(value) ? "fill-amber-400 text-amber-500" : "fill-slate-100 text-slate-300")} />
      ))}
    </span>
  );
}

export function RatingInline({ avg, count, testid }: { avg: number | null; count: number; testid?: string }) {
  if (avg === null || count === 0)
    return (
      <span className="text-xs text-slate-500" data-testid={testid}>
        New swapper
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700" data-testid={testid}>
      <Star className="size-3.5 fill-amber-400 text-amber-500" /> {avg.toFixed(1)}
      <span className="font-normal text-slate-500">({count})</span>
    </span>
  );
}

export function TrustBadge({ className, testid }: { className?: string; testid?: string }) {
  return (
    <span
      data-testid={testid}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 border-slate-900 bg-emerald-300 px-2 py-0.5 text-[11px] font-extrabold text-slate-900",
        className,
      )}
    >
      <BadgeCheck className="size-3.5" /> Trusted swapper
    </span>
  );
}
