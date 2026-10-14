import { Link } from "react-router-dom";
import { BadgeEuro, Clock, ShieldCheck, Tag, Truck } from "lucide-react";
import { CtaBand, FeeTable, SectionLabel } from "@/components/Sections";
import FeeCalculator from "@/components/FeeCalculator";
import { LABEL_SIZES, euro } from "@/lib/fees";

const POINTS = [
  { icon: BadgeEuro, title: "Free to list", body: "List as many items as you like. Making offers is free too." },
  { icon: Clock, title: "Pay only when accepted", body: "Once the owner accepts, you have 48 hours to pay the fee and confirm." },
  { icon: ShieldCheck, title: "Secure checkout", body: "Payments are processed securely by Stripe. We never see your card details." },
];

export default function Pricing() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <SectionLabel>Pricing</SectionLabel>
      <h1 className="mt-2 max-w-3xl text-5xl font-extrabold leading-tight text-slate-900" data-testid="pricing-title">
        Free to list. A small fee to complete a swap.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-700">
        The person requesting a swap pays a processing fee of <strong>5% of the item's estimated value</strong>, with a
        minimum of €0.99 and a maximum of €19.99. The owner pays nothing.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {POINTS.map((p, i) => (
          <div key={p.title} data-testid={`pricing-point-${i}`} className="brutal rounded-2xl bg-white p-6">
            <p.icon className="size-7" />
            <h3 className="mt-3 text-lg font-extrabold">{p.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{p.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-20 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SectionLabel>Examples</SectionLabel>
          <h2 className="mt-2 text-3xl font-extrabold">What you'd pay</h2>
          <div className="mt-6">
            <FeeTable />
          </div>
        </div>
        <div className="lg:pt-16">
          <FeeCalculator />
        </div>
      </div>

      <div className="mt-20">
        <SectionLabel>Optional add-on</SectionLabel>
        <h2 className="mt-2 inline-flex items-center gap-3 text-3xl font-extrabold">
          <Tag className="size-7" /> Tracked shipping labels
        </h2>
        <p className="mt-3 max-w-2xl text-slate-700">
          Whoever sends an item pays its postage. To make it easy, buy a printable tracked label in the app once your
          swap is confirmed. The tracking number is shared with your swap partner automatically.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="label-price-grid">
          {LABEL_SIZES.map((s, i) => (
            <div key={s.id} data-testid={`label-price-${s.id}`} className={`brutal rounded-2xl p-5 ${i % 2 ? "bg-sky-100" : "bg-white"}`}>
              <Truck className="size-6" />
              <p className="mt-3 font-heading text-lg font-extrabold">{s.label}</p>
              <p className="text-xs text-slate-600">{s.description}</p>
              <p className="mt-3 font-heading text-3xl font-extrabold">{euro(s.price_cents)}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold text-amber-800" data-testid="label-demo-pricing-note">
          Labels run in DEMO mode for now (sample labels and tracking) until a shipping provider is connected.
        </p>
      </div>

      <div className="mt-20">
        <CtaBand />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Questions? <Link to="/how-it-works" className="font-semibold underline">See how it works</Link>
      </p>
    </div>
  );
}
