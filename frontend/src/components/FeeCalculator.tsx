import { useState } from "react";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { euro, processingFeeCents } from "@/lib/fees";

const PRESETS = [10, 45, 140, 220, 600];

export default function FeeCalculator() {
  const [value, setValue] = useState("140");
  const fee = processingFeeCents(Number(value));

  return (
    <div data-testid="fee-calculator" className="brutal rounded-3xl bg-white p-6">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-emerald-100">
          <Calculator className="size-4 text-emerald-800" />
        </span>
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Swap fee calculator</p>
      </div>
      <label htmlFor="calc-value" className="mt-4 block text-sm font-semibold text-slate-800">
        What's the item you want worth?
      </label>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500">€</span>
          <Input
            id="calc-value"
            data-testid="fee-calculator-input"
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-12 rounded-xl border-2 border-slate-900 pl-7 text-lg font-bold"
          />
        </div>
        <div className="grid min-w-28 place-items-center rounded-xl border-2 border-slate-900 bg-amber-300 px-3 py-1.5">
          <span key={fee} data-testid="fee-calculator-result" className="animate-pop-in font-heading text-2xl font-extrabold leading-none">
            {fee > 0 ? euro(fee) : "—"}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider">swap fee</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            data-testid={`fee-calculator-preset-${p}`}
            onClick={() => setValue(String(p))}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-900 hover:bg-emerald-50"
          >
            €{p}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        5% of the item's value (min €0.99, max €19.99). Listing is always free. You only pay once the owner accepts
        your offer.
      </p>
    </div>
  );
}
