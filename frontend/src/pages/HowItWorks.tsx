import { CtaBand, Faq, FeeTable, HowSteps, SectionLabel } from "@/components/Sections";
import FeeCalculator from "@/components/FeeCalculator";
import { Truck } from "lucide-react";

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <SectionLabel>How it works</SectionLabel>
      <h1 className="mt-2 max-w-3xl text-5xl font-extrabold leading-tight text-slate-900" data-testid="how-title">
        Swapping, made simple (and a little bit fun).
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-700">
        No haggling and no cash between strangers. Listing is free, you trade item for item, and a small processing
        fee confirms each swap.
      </p>
      <div className="mt-12">
        <HowSteps />
      </div>

      <div className="mt-24 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SectionLabel>The processing fee</SectionLabel>
          <h2 className="mt-2 text-3xl font-extrabold">The person requesting the swap pays 5%</h2>
          <p className="mt-3 text-slate-700">
            Offer your €8 paperback for someone's €140 camera. If they accept, you pay <strong>€7.00</strong> (5% of the
            camera's value) within 48 hours to confirm the swap. The owner pays nothing. Fees start at €0.99 and are
            capped at €19.99.
          </p>
          <div className="mt-6">
            <FeeTable />
          </div>
        </div>
        <div className="space-y-6 lg:pt-16">
          <FeeCalculator />
          <div className="brutal flex gap-4 rounded-2xl bg-sky-100 p-5" data-testid="postage-notice">
            <Truck className="mt-0.5 size-6 shrink-0" />
            <div>
              <p className="font-heading font-bold">Postage &amp; packaging</p>
              <p className="mt-1 text-sm text-slate-700">
                Whoever sends an item pays for its postage and packaging. You can buy a tracked shipping label in the
                app from €5.00, and the tracking number is shared with your swap partner automatically.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-24">
        <SectionLabel>FAQ</SectionLabel>
        <h2 className="mt-2 text-3xl font-extrabold">Questions, answered</h2>
        <div className="mt-6">
          <Faq />
        </div>
      </div>
      <div className="mt-24">
        <CtaBand />
      </div>
    </div>
  );
}
