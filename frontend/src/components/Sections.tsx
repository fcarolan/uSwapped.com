import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Handshake, Package, Search, Upload } from "lucide-react";
import { FEE_EXAMPLES, eur, euro, processingFeeCents } from "@/lib/fees";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: Upload, title: "List it free", body: "Snap a photo and add an estimated value. Listing is always free.", bg: "bg-emerald-100" },
  { icon: Search, title: "Offer a swap", body: "Found something you love? Offer one of your items in exchange. Offers are free too.", bg: "bg-amber-100" },
  { icon: Handshake, title: "Accepted? Complete it", body: "When the owner says yes, you pay a small processing fee (5% of the item's value) to confirm the swap.", bg: "bg-pink-100" },
  { icon: Package, title: "Post it", body: "Each of you posts your own item at your own cost. Buy a tracked shipping label in the app if you like.", bg: "bg-sky-100" },
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

export function FeeTable() {
  return (
    <div className="brutal overflow-hidden rounded-2xl bg-white" data-testid="fee-table">
      <div className="grid grid-cols-[1.4fr_1fr_auto] gap-4 border-b-2 border-slate-900 bg-slate-900 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white">
        <span>You want</span>
        <span>Est. value</span>
        <span className="text-right">Swap fee</span>
      </div>
      {FEE_EXAMPLES.map((t, i) => (
        <div
          key={t.item}
          data-testid={`fee-row-${i}`}
          className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-4 border-b border-slate-200 px-5 py-3.5 last:border-b-0 transition-colors duration-150 hover:bg-amber-50"
        >
          <span className="text-sm font-semibold">{t.item}</span>
          <span className="font-mono text-sm text-slate-600">{eur(t.value)}</span>
          <span className="text-right">
            <span className="font-heading font-extrabold">{euro(processingFeeCents(t.value))}</span>
            <span className="ml-1.5 text-[10px] font-bold uppercase text-slate-400">{t.note}</span>
          </span>
        </div>
      ))}
      <div className="bg-emerald-50 px-5 py-3 text-xs text-slate-600">
        Listing and making offers are free. The fee is only charged to the person requesting the swap, after the owner accepts.
      </div>
    </div>
  );
}

const FAQS = [
  {
    q: "Is it free to list?",
    a: "Yes. Listing items and making swap offers are completely free. No money changes hands between swappers.",
  },
  {
    q: "What's the processing fee?",
    a: "When an owner accepts your offer, you pay 5% of the estimated value of the item you're getting (minimum €0.99, maximum €19.99) to confirm the swap. A €20 book costs €1.00, and a €600 laptop is capped at €19.99.",
  },
  {
    q: "What if I don't pay?",
    a: "You have 48 hours after your offer is accepted. If you don't pay in that time, the swap expires and both items go back on the market. Declined or cancelled offers cost nothing.",
  },
  {
    q: "Who pays for postage?",
    a: "Whoever sends an item pays for its postage and packaging. If you like, you can buy a tracked shipping label right in the app (from €5.00), and the tracking number is shared with your swap partner automatically.",
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
