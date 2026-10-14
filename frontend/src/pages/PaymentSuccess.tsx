import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Download, MessageCircle, PartyPopper, Tag } from "lucide-react";
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
  const isLabel = data?.kind === "label";

  useEffect(() => {
    if (paid) {
      qc.invalidateQueries({ queryKey: ["swaps"] });
      qc.invalidateQueries({ queryKey: ["payment-history"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [paid, qc]);

  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <div className="brutal animate-pop-in rounded-3xl bg-white p-10 text-center" data-testid="payment-result-card">
        {paid ? (
          <>
            <div className="mx-auto grid size-20 animate-wiggle place-items-center rounded-full border-2 border-slate-900 bg-amber-300">
              {isLabel ? <Tag className="size-9" /> : <PartyPopper className="size-9" />}
            </div>
            <h1 className="mt-6 text-4xl font-extrabold" data-testid="payment-success-title">
              {isLabel ? "Your label is ready!" : "Swap confirmed!"}
            </h1>
            <p className="mt-2 text-slate-600" data-testid="payment-success-body">
              {isLabel
                ? "Print it, stick it on your parcel and drop it off. We've shared the tracking number with your swap partner."
                : "Your processing fee is paid. Say hi in the chat and arrange posting your items."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {isLabel && data.label_id && (
                <a
                  href={`/api/labels/${data.label_id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="payment-download-label"
                  className="brutal brutal-hover inline-flex items-center gap-1.5 rounded-full bg-sky-200 px-5 py-2.5 text-sm font-bold"
                >
                  <Download className="size-4" /> Download label (DEMO)
                </a>
              )}
              <Link
                to={`/swaps/${data.swap_id}/chat`}
                data-testid="payment-open-chat"
                className="brutal brutal-hover inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-900"
              >
                <MessageCircle className="size-4" /> Open swap chat
              </Link>
            </div>
          </>
        ) : failed ? (
          <h1 className="text-3xl font-extrabold" data-testid="payment-failed-title">Payment didn't go through</h1>
        ) : isError || timedOut || !sessionId ? (
          <>
            <h1 className="text-3xl font-extrabold" data-testid="payment-unknown-title">We're still checking your payment</h1>
            <p className="mt-2 text-slate-600">Your swap updates automatically as soon as Stripe confirms.</p>
          </>
        ) : (
          <>
            <div className="mx-auto size-12 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
            <h1 className="mt-6 text-2xl font-extrabold" data-testid="payment-processing-title">Confirming your payment…</h1>
          </>
        )}
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/dashboard?tab=outgoing" data-testid="payment-dashboard-link" className="rounded-full border-2 border-slate-900 bg-white px-5 py-2.5 text-sm font-bold">
            My swaps
          </Link>
        </div>
      </div>
    </div>
  );
}
