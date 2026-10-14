import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import type { CheckoutResponse } from "@/lib/types";
import { CREDIT_PACKS, PACK_BLURBS, euro } from "@/lib/credits";
import { errorMessage, startGoogleLogin, useMe } from "@/lib/hooks";
import { SectionLabel, TierTable } from "@/components/Sections";
import { cn } from "@/lib/utils";

const BG = ["bg-white", "bg-emerald-100", "bg-amber-300", "bg-violet-100"];

export default function Credits() {
  const { data: me } = useMe();
  const checkout = useMutation({
    mutationFn: (pack_id: string) =>
      apiPost<CheckoutResponse>("/payments/checkout", { pack_id, origin_url: window.location.origin }),
    onSuccess: (r) => {
      window.location.href = r.checkout_url;
    },
    onError: (e) => toast.error(errorMessage(e, "Couldn't start checkout")),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-14">
      <SectionLabel>Swap Credits</SectionLabel>
      <h1 className="mt-2 max-w-3xl text-5xl font-extrabold leading-tight text-slate-900" data-testid="credits-title">
        Top up once, swap all year.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-700">
        Credits never expire. Spend them only when a swap is accepted.
        {me && (
          <>
            {" "}You currently have <strong data-testid="credits-current-balance">{me.credits} credits</strong>.
          </>
        )}
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {CREDIT_PACKS.map((p, i) => (
          <div
            key={p.id}
            data-testid={`credit-pack-${p.credits}`}
            className={cn(
              "brutal relative flex flex-col rounded-3xl p-6 transition-transform duration-200 hover:-translate-y-1",
              BG[i],
              p.popular && "lg:-translate-y-3 lg:hover:-translate-y-4",
            )}
          >
            {p.popular && (
              <span className="absolute -top-3.5 left-6 inline-flex items-center gap-1 rounded-full border-2 border-slate-900 bg-slate-900 px-3 py-0.5 text-xs font-bold text-white">
                <Sparkles className="size-3" /> Most popular
              </span>
            )}
            <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-slate-700">{p.label}</p>
            <p className="mt-3 inline-flex items-center gap-2 font-heading text-5xl font-extrabold">
              <Coins className="size-9" /> {p.credits}
            </p>
            <p className="text-sm font-semibold">credits</p>
            <p className="mt-4 font-heading text-3xl font-extrabold" data-testid={`credit-pack-price-${p.credits}`}>{euro(p.amount_cents)}</p>
            <p className="font-mono text-xs text-slate-600">{euro(Math.round((p.amount_cents / p.credits) * 100) / 100)} / credit</p>
            <p className="mt-3 flex-1 text-sm text-slate-700">{PACK_BLURBS[p.id]}</p>
            <Button
              data-testid={`buy-credits-pack-${p.credits}`}
              disabled={checkout.isPending}
              onClick={() => (me ? checkout.mutate(p.id) : startGoogleLogin())}
              className="brutal brutal-hover mt-6 h-11 rounded-full bg-slate-900 font-bold text-white hover:bg-slate-800"
            >
              {checkout.isPending && checkout.variables === p.id ? "Opening checkout…" : me ? "Buy now" : "Sign in to buy"}
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-8 inline-flex items-center gap-2 text-sm text-slate-600">
        <ShieldCheck className="size-4 text-emerald-700" /> Secure checkout by Stripe. Prices in EUR, taxes calculated at checkout.
      </p>

      <div className="mt-20 grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <SectionLabel>What does a swap cost?</SectionLabel>
          <h2 className="mt-2 text-3xl font-extrabold">Credits match the item's value</h2>
          <p className="mt-3 text-slate-700">
            When a swap is accepted, each swapper spends credits for the item they receive. Under €10? Just 1 credit.
            Electronics and high-value items cost 4% of their value in credits, capped at 50.
          </p>
        </div>
        <TierTable />
      </div>
    </div>
  );
}
