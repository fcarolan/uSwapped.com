import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ArrowRight, Sparkles, Truck } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Item } from "@/lib/types";
import ItemCard, { FeeBadge, ItemCardSkeleton } from "@/components/ItemCard";
import FeeCalculator from "@/components/FeeCalculator";
import { CtaBand, Faq, FeeTable, HowSteps, SectionLabel } from "@/components/Sections";
import { CATEGORIES } from "@/lib/types";
import { eur, processingFeeCents } from "@/lib/fees";

const HERO_FALLBACK = [
  { title: "Vintage Camera", image_url: "https://images.unsplash.com/26/camera-keys.jpg?w=700&q=80", value_eur: 140 },
  { title: "Retro Typewriter", image_url: "https://images.unsplash.com/photo-1708102399096-b01391f99fbb?w=700&q=80", value_eur: 85 },
];

export default function Landing() {
  const { data: items, isPending, isError } = useQuery({ queryKey: ["items", "", ""], queryFn: () => apiGet<Item[]>("/items") });
  const featured = isError ? [] : (items ?? []).slice(0, 4);
  const duo = items && items.length >= 2 && !isError ? items.slice(0, 2) : HERO_FALLBACK;

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b-2 border-slate-900 bg-[radial-gradient(circle_at_10%_20%,#ECFDF5_0%,#FFFBEB_55%,#FAFAF7_100%)]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div className="animate-pop-in">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-slate-900 bg-white px-3 py-1 text-xs font-bold">
              <Sparkles className="size-3.5 text-amber-500" /> Free to list. Always.
            </span>
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.02] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
              Swap your stuff,
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">not your cash.</span>
                <span className="absolute inset-x-0 bottom-1 -z-0 h-4 -rotate-1 bg-emerald-300 sm:h-5" />
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-700">
              USwapped is the friendly marketplace where nothing is sold — everything is swapped. List what you don't
              need for free, find what you love, and confirm your swap with a small processing fee.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/browse"
                data-testid="hero-browse-button"
                className="brutal brutal-hover inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3.5 text-sm font-bold text-white"
              >
                Start swapping <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/list"
                data-testid="hero-list-button"
                className="brutal brutal-hover rounded-full bg-white px-6 py-3.5 text-sm font-bold text-slate-900"
              >
                List an item
              </Link>
            </div>
            <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-600">
              <Truck className="size-4" /> Senders pay their own postage. Tracked labels available in the app.
            </p>
          </div>

          <div className="relative">
            <div className="relative mx-auto h-[380px] max-w-md sm:h-[420px]">
              {duo.map((it, i) => (
                <div
                  key={it.title}
                  className={
                    "brutal absolute w-[58%] overflow-hidden rounded-2xl bg-white " +
                    (i === 0 ? "left-0 top-0 animate-float [--tilt:-5deg]" : "bottom-0 right-0 animate-float-delayed [--tilt:4deg]")
                  }
                >
                  <img src={it.image_url} alt={it.title} className="aspect-square w-full border-b-2 border-slate-900 object-cover" />
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{it.title}</p>
                      <p className="font-mono text-[11px] text-slate-500">est. {eur(it.value_eur)}</p>
                    </div>
                    <FeeBadge cents={processingFeeCents(it.value_eur)} />
                  </div>
                </div>
              ))}
              <div className="brutal absolute left-1/2 top-1/2 z-10 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-amber-300">
                <ArrowLeftRight className="size-7 animate-spin-slow" strokeWidth={2.75} />
              </div>
            </div>
          </div>
        </div>

        {/* category marquee */}
        <div className="overflow-hidden border-t-2 border-slate-900 bg-slate-900 py-3">
          <div className="flex w-max animate-marquee gap-8 whitespace-nowrap">
            {[...CATEGORIES, ...CATEGORIES].map((c, i) => (
              <Link
                key={`${c}-${i}`}
                to={`/browse?category=${encodeURIComponent(c)}`}
                className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-white/80 transition-colors hover:text-emerald-300"
              >
                {c} <span className="ml-8 text-emerald-400">✦</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-6 pt-20" id="how">
        <SectionLabel>How it works</SectionLabel>
        <h2 className="mt-2 max-w-2xl text-4xl font-extrabold text-slate-900">Four steps from clutter to "ooh, nice".</h2>
        <div className="mt-10">
          <HowSteps />
        </div>
      </section>

      {/* FRESH SWAPS */}
      <section className="mx-auto max-w-7xl px-6 pt-24">
        <div className="flex items-end justify-between gap-4">
          <div>
            <SectionLabel>Fresh on USwapped</SectionLabel>
            <h2 className="mt-2 text-4xl font-extrabold text-slate-900">Up for swaps right now</h2>
          </div>
          <Link to="/browse" data-testid="landing-see-all" className="hidden items-center gap-1 text-sm font-bold text-emerald-700 hover:underline sm:inline-flex">
            See everything <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {isPending && Array.from({ length: 4 }).map((_, i) => <ItemCardSkeleton key={i} />)}
          {featured.map((it, i) => <ItemCard key={it.id} item={it} index={i} />)}
          {!isPending && featured.length === 0 && (
            <p className="text-slate-500" data-testid="landing-items-empty">Listings are loading soon — check back in a moment.</p>
          )}
        </div>
      </section>

      {/* CREDITS */}
      <section className="mx-auto grid max-w-7xl gap-10 px-6 pt-24 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SectionLabel>Simple, fair pricing</SectionLabel>
          <h2 className="mt-2 text-4xl font-extrabold text-slate-900">Free to list. 5% to complete a swap.</h2>
          <p className="mt-4 max-w-md text-slate-700">
            Only the person requesting a swap pays, and only once the owner accepts. Small swaps cost €0.99, and big
            swaps are capped at €19.99.
          </p>
          <div className="mt-6">
            <FeeCalculator />
          </div>
          <Link to="/pricing" data-testid="landing-pricing-link" className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:underline">
            See pricing &amp; shipping labels <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="lg:pt-16">
          <FeeTable />
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-7xl px-6 pt-24">
        <SectionLabel>Questions</SectionLabel>
        <h2 className="mt-2 text-4xl font-extrabold text-slate-900">Good to know</h2>
        <div className="mt-8">
          <Faq />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-24">
        <CtaBand />
      </section>
    </div>
  );
}
