import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Coins, PartyPopper } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { PaymentStatus } from "@/lib/types";

const MAX_POLLS = 15;

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id") ?? "";
  const qc = useQueryClient();
  const polls = useRef(0);
  const { data, isError } = useQuery({
    queryKey: ["payment-status", sessionId],
    queryFn: () => {
      polls.current += 1;
      return apiGet<PaymentStatus>(`/payments/status/${sessionId}`);
    },
    enabled: !!sessionId,
    refetchInterval: (q) => {
      const s = q.state.data?.payment_status;
      if (s === "paid" || s === "expired" || s === "failed") return false;
      return polls.current >= MAX_POLLS ? false : 2000;
    },
  });
  const paid = data?.payment_status === "paid";
  const failed = data?.payment_status === "expired" || data?.payment_status === "failed";
  const timedOut = !paid && !failed && polls.current >= MAX_POLLS;

  useEffect(() => {
    if (paid) {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["credit-history"] });
    }
  }, [paid, qc]);

  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <div className="brutal animate-pop-in rounded-3xl bg-white p-10 text-center" data-testid="payment-result-card">
        {paid ? (
          <>
            <div className="mx-auto grid size-20 animate-wiggle place-items-center rounded-full border-2 border-slate-900 bg-amber-300">
              <PartyPopper className="size-9" />
            </div>
            <h1 className="mt-6 text-4xl font-extrabold" data-testid="payment-success-title">Credits added!</h1>
            <p className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-slate-700" data-testid="payment-credits-added">
              <Coins className="size-5 text-amber-600" /> +{data.credits} Swap Credits
            </p>
          </>
        ) : failed ? (
          <h1 className="text-3xl font-extrabold" data-testid="payment-failed-title">Payment didn't go through</h1>
        ) : isError || timedOut || !sessionId ? (
          <>
            <h1 className="text-3xl font-extrabold" data-testid="payment-unknown-title">We're still checking your payment</h1>
            <p className="mt-2 text-slate-600">Your credits will appear in your wallet as soon as Stripe confirms.</p>
          </>
        ) : (
          <>
            <div className="mx-auto size-12 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
            <h1 className="mt-6 text-2xl font-extrabold" data-testid="payment-processing-title">Confirming your payment…</h1>
          </>
        )}
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/browse" data-testid="payment-browse-link" className="brutal brutal-hover rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">
            Browse swaps
          </Link>
          <Link to="/dashboard?tab=history" data-testid="payment-dashboard-link" className="brutal brutal-hover rounded-full bg-white px-5 py-2.5 text-sm font-bold">
            My wallet
          </Link>
        </div>
      </div>
    </div>
  );
}
