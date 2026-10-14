import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, PackageCheck, Star } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import ItemCard from "@/components/ItemCard";
import { Stars, TrustBadge } from "@/components/Trust";

export default function Profile() {
  const { id = "" } = useParams();
  const { data, isPending, isError } = useQuery({ queryKey: ["profile", id], queryFn: () => apiGet<UserProfile>(`/users/${id}`) });
  const p = isError ? undefined : data;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link to="/browse" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900" data-testid="profile-back-link">
        <ArrowLeft className="size-4" /> Browse
      </Link>

      <div className="brutal mt-6 flex flex-col gap-6 rounded-3xl bg-white p-6 sm:flex-row sm:items-center" data-testid="profile-header">
        {isPending ? (
          <div className="h-24 w-full animate-pulse rounded-2xl bg-slate-100" />
        ) : !p ? (
          <p className="text-slate-600" data-testid="profile-not-found">This swapper couldn't be loaded.</p>
        ) : (
          <>
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-slate-900 bg-emerald-100 font-heading text-3xl font-extrabold">
              {p.picture ? <img src={p.picture} alt="" className="size-full object-cover" /> : p.name[0]}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-extrabold" data-testid="profile-name">{p.name}</h1>
                {p.trusted && <TrustBadge testid="profile-trusted-badge" />}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                {p.rating_avg !== null ? (
                  <span className="inline-flex items-center gap-1.5" data-testid="profile-rating">
                    <Stars value={p.rating_avg} /> <strong className="text-slate-900">{p.rating_avg.toFixed(1)}</strong> ({p.rating_count} rating{p.rating_count === 1 ? "" : "s"})
                  </span>
                ) : (
                  <span data-testid="profile-rating">No ratings yet</span>
                )}
                <span className="inline-flex items-center gap-1">
                  <PackageCheck className="size-4" /> {p.swaps_completed} swaps received
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-4" /> Member since {new Date(p.member_since).toLocaleDateString("en-IE", { month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="text-2xl font-extrabold">Up for swaps</h2>
          {p && p.items.length === 0 && <p className="mt-4 text-sm text-slate-600" data-testid="profile-no-items">Nothing listed right now.</p>}
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {p?.items.map((it, i) => <ItemCard key={it.id} item={it} index={i} />)}
          </div>
        </section>
        <section>
          <h2 className="inline-flex items-center gap-2 text-2xl font-extrabold">
            <Star className="size-6 fill-amber-400 text-amber-500" /> Reviews
          </h2>
          {p && p.ratings.length === 0 && <p className="mt-4 text-sm text-slate-600" data-testid="profile-no-reviews">No reviews yet.</p>}
          <div className="mt-5 space-y-3">
            {p?.ratings.map((r) => (
              <div key={r.id} className="rounded-2xl border-2 border-slate-200 bg-white p-4" data-testid={`profile-review-${r.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{r.rater_name}</span>
                  <Stars value={r.stars} />
                </div>
                {r.comment && <p className="mt-1.5 text-sm text-slate-700">"{r.comment}"</p>}
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Swapped {r.item_title} · {new Date(r.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
