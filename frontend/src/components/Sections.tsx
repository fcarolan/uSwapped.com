import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Coins, Handshake, Package, Search, Upload } from "lucide-react";
import { CREDIT_TIERS } from "@/lib/credits";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: Upload, title: "List it", body: "Snap a photo, add an estimated value. We work out the credit cost instantly.", bg: "bg-emerald-100" },
  { icon: Search, title: "Find a swap", body: "Browse items near you and offer one of yours in exchange.", bg: "bg-amber-100" },
  { icon: Handshake, title: "Agree & pay credits", body: "When the owner accepts, each swapper spends credits for the item they receive.", bg: "bg-violet-100" },
  { icon: Package, title: "Post it", body: "You each pack and post your own item at your own cost. Enjoy your new thing!", bg: "bg-sky-100" },
];

export function HowSteps() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((s, i) => (
        <div
          key={s.title}
          data-testid={`how-step-${i + 1}`}
          className={cn("brutal relative rounded-2xl p-6", s.bg, i % 2 === 1 && "lg:translate-y-6")}
        >
          <span className="absolute -top-4 right-5 grid size-9 place-items-center rounded-full border-2 border-slate-900 bg-white font-heading font-extrabold">
            {i + 1}
          </span>
          <s.icon className="size-7 text-slate-900" strokeWidth={2.25} />
          <h3 className="mt-4 text-xl font-extrabold text-slate-900">{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

export function TierTable() {
  return (
    <div className="brutal overflow-hidden rounded-2xl bg-white" data-testid="credit-tier-table">
      <div className="grid grid-cols-[1fr_1.4fr_auto] gap-4 border-b-2 border-slate-900 bg-slate-900 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white">
        <span>Item value</span>
        <span className="hidden sm:block">Typical items</span>
        <span className="text-right">Credits</span>
      </div>
      {CREDIT_TIERS.map((t, i) => (
        <div
          key={t.label}
          data-testid={`credit-tier-row-${i}`}
          className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-4 border-b border-slate-200 px-5 py-3.5 last:border-b-0 transition-colors duration-150 hover:bg-amber-50"
        >
          <span className="font-mono text-sm font-semibold">{t.label}</span>
          <span className="hidden text-sm text-slate-600 sm:block">{t.example}</span>
          <span className="inline-flex items-center justify-end gap-1 text-right font-heading font-extrabold">
            <Coins className="size-4 text-amber-600" /> {t.credits}
          </span>
        </div>
      ))}
    </div>
  );
}

const FAQS = [
  {
    q: "Is swapping really free?",
    a: "No money changes hands between swappers. You use Swap Credits to confirm a swap — new members get 3 free credits, and packs start at €1.99.",
  },
  {
    q: "Who pays for postage?",
    a: "Each swapper sorts the postage and packaging for the item they're sending, at their own cost. Once a swap is accepted you'll both see each other's contact email to arrange it.",
  },
  {
    q: "When are credits taken?",
    a: "Only when a swap is accepted. Proposing is free — you just need enough credits in your wallet. Declined or cancelled offers cost nothing.",
  },
  {
    q: "Why do bigger items cost more credits?",
    a: "Credits scale with value so a €5 paperback costs 1 credit, while a €600 laptop costs around 24 (4%, capped at 50). It keeps small swaps cheap and big swaps fair.",
  },
];

export function Faq() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {FAQS.map((f, i) => (
        <details
          key={f.q}
          data-testid={`faq-item-${i}`}
          className="group rounded-2xl border-2 border-slate-900 bg-white p-5 transition-shadow duration-200 open:shadow-[4px_4px_0_#0f172a]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between font-heading text-lg font-bold">
            {f.q}
            <span className="ml-3 text-2xl leading-none transition-transform duration-200 group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">{children}</p>
  );
}

export function CtaBand() {
  return (
    <div className="brutal relative overflow-hidden rounded-3xl bg-emerald-400 px-8 py-12 sm:px-12">
      <div className="absolute -right-10 -top-10 size-48 animate-spin-slow rounded-full border-[14px] border-dashed border-slate-900/15" />
      <h2 className="max-w-xl text-3xl font-extrabold text-slate-900 sm:text-4xl">
        Got something gathering dust? Someone out there wants it.
      </h2>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/list"
          data-testid="cta-list-item"
          className="brutal brutal-hover rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white"
        >
          List your first item
        </Link>
        <Link
          to="/browse"
          data-testid="cta-browse"
          className="brutal brutal-hover rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900"
        >
          Browse swaps
        </Link>
      </div>
    </div>
  );
}
