import { CtaBand, Faq, HowSteps, SectionLabel, TierTable } from "@/components/Sections";
import CreditCalculator from "@/components/CreditCalculator";
import { Truck } from "lucide-react";

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <SectionLabel>How it works</SectionLabel>
      <h1 className="mt-2 max-w-3xl text-5xl font-extrabold leading-tight text-slate-900" data-testid="how-title">
        Swapping, made simple (and a little bit fun).
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-700">
        No haggling, no cash between strangers. You trade item-for-item, and Swap Credits keep everything fair and
        spam-free.
      </p>
      <div className="mt-12">
        <HowSteps />
      </div>

      <div className="mt-24 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SectionLabel>The credit formula</SectionLabel>
          <h2 className="mt-2 text-3xl font-extrabold">You pay for what you receive</h2>
          <p className="mt-3 text-slate-700">
            When a swap is accepted, <strong>both</strong> swappers spend credits based on the value of the item
            they're getting. Swap a €8 paperback for a €140 camera? You pay 8 credits for the camera, they pay 1 credit
            for the book.
          </p>
          <div className="mt-6">
            <TierTable />
          </div>
        </div>
        <div className="space-y-6 lg:pt-16">
          <CreditCalculator />
          <div className="brutal flex gap-4 rounded-2xl bg-sky-100 p-5" data-testid="postage-notice">
            <Truck className="mt-0.5 size-6 shrink-0" />
            <div>
              <p className="font-heading font-bold">Postage &amp; packaging</p>
              <p className="mt-1 text-sm text-slate-700">
                Each swapper sorts the postage and packaging for the item they're sending, at their own cost. After
                acceptance you'll see each other's email to arrange delivery.
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
