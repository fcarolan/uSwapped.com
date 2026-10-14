import { useState } from "react";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { creditsForValue, euro } from "@/lib/credits";

const PRESETS = [5, 35, 80, 180, 600];

export default function CreditCalculator() {
  const [value, setValue] = useState("180");
  const num = Number(value);
  const credits = creditsForValue(num);
  // cheapest per-credit price is the 100 pack: €0.0999/credit
  const costCents = Math.round(credits * 9.99);

  return (
    <div data-testid="credit-calculator" className="brutal rounded-3xl bg-white p-6">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-emerald-100">
          <Calculator className="size-4 text-emerald-800" />
        </span>
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Credit calculator</p>
      </div>
      <label htmlFor="calc-value" className="mt-4 block text-sm font-semibold text-slate-800">
        What's your item worth?
      </label>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500">€</span>
          <Input
            id="calc-value"
            data-testid="credit-calculator-input"
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-12 rounded-xl border-2 border-slate-900 pl-7 text-lg font-bold"
          />
        </div>
        <div className="grid min-w-24 place-items-center rounded-xl border-2 border-slate-900 bg-amber-300 px-3 py-1.5">
          <span key={credits} data-testid="credit-calculator-result" className="animate-pop-in font-heading text-3xl font-extrabold leading-none">
            {credits}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider">credits</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            data-testid={`credit-calculator-preset-${p}`}
            onClick={() => setValue(String(p))}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-900 hover:bg-emerald-50"
          >
            €{p}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        {credits > 0 ? (
          <>
            That's from just <strong className="text-slate-800">{euro(costCents)}</strong> in credits — each swapper pays
            for the item they receive and posts their own item at their own cost.
          </>
        ) : (
          "Enter an estimated value to see the credit cost."
        )}
      </p>
    </div>
  );
}
