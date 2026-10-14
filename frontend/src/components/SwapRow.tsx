import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftRight, Check, Clock, CreditCard, Mail, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import SwapProgress from "@/components/SwapProgress";
import { apiPost } from "@/lib/api";
import { euro } from "@/lib/fees";
import { errorMessage } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { CheckoutResponse, Swap, SwapFeeCheckout } from "@/lib/types";

type SwapAction = "accept" | "decline" | "cancel";

const STATUS_STYLE: Record<Swap["status"], string> = {
  pending: "bg-amber-100 text-amber-900",
  awaiting_payment: "bg-pink-100 text-pink-900",
  accepted: "bg-emerald-100 text-emerald-900",
  declined: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-600",
  expired: "bg-slate-100 text-slate-600",
};

const STATUS_LABEL: Record<Swap["status"], string> = {
  pending: "Pending",
  awaiting_payment: "Awaiting fee",
  accepted: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
};

function dueText(iso: string | null): string {
  if (!iso) return "";
  const h = Math.max(0, (new Date(iso).getTime() - Date.now()) / 3_600_000);
  return h >= 1 ? `${Math.floor(h)}h left` : `${Math.max(1, Math.round(h * 60))}m left`;
}

function useSwapAction(swapId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: SwapAction) => apiPost<Swap>(`/swaps/${swapId}/${action}`),
    onSuccess: (_s, action) => {
      qc.invalidateQueries({ queryKey: ["swaps"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(action === "accept" ? "Accepted! We've asked them to pay the processing fee to confirm 🎉" : `Offer ${action}ed`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

function SwapSummary({ swap, incoming }: { swap: Swap; incoming: boolean }) {
  // what *I* give / get
  const give = incoming ? swap.target_item : swap.offered_item;
  const get = incoming ? swap.offered_item : swap.target_item;
  const other = incoming ? swap.proposer_name : swap.owner_name;
  return (
    <div className="flex flex-1 items-center gap-3">
      <img src={give.image_url} alt="" className="size-16 rounded-xl border-2 border-slate-900 object-cover" />
      <ArrowLeftRight className="size-5 shrink-0 text-emerald-700" />
      <img src={get.image_url} alt="" className="size-16 rounded-xl border-2 border-slate-900 object-cover" />
      <div className="min-w-0">
        <p className="truncate text-sm">
          You give <strong>{give.title}</strong>
        </p>
        <p className="truncate text-sm">
          You get <strong>{get.title}</strong>
        </p>
        <p className="text-xs text-slate-500">
          {incoming ? "From" : "To"} {other} · {incoming ? "free for you" : <>swap fee <strong>{euro(swap.fee_cents)}</strong></>}
        </p>
        {swap.message && <p className="mt-1 truncate text-xs italic text-slate-500">"{swap.message}"</p>}
      </div>
    </div>
  );
}

/** Proposer side of a swap that is pending or waiting for the fee: pay + cancel. */
function ProposerActions({ swap }: { swap: Swap }) {
  const act = useSwapAction(swap.id);
  const pay = useMutation({
    mutationFn: (body: SwapFeeCheckout) => apiPost<CheckoutResponse>("/payments/swap-fee", body),
    onSuccess: (r) => window.location.assign(r.checkout_url),
    onError: (e) => toast.error(errorMessage(e, "Couldn't start the payment")),
  });
  return (
    <>
      {swap.status === "awaiting_payment" && (
        <>
          <Button
            size="sm"
            data-testid={`swap-pay-fee-${swap.id}`}
            disabled={pay.isPending}
            onClick={() => pay.mutate({ swap_id: swap.id, origin_url: window.location.origin })}
            className="brutal brutal-hover rounded-full bg-emerald-400 text-slate-900 hover:bg-emerald-300"
          >
            <CreditCard className="size-4" /> {pay.isPending ? "Opening checkout…" : `Pay ${euro(swap.fee_cents)} to complete`}
          </Button>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-pink-800" data-testid={`swap-due-${swap.id}`}>
            <Clock className="size-3.5" /> {dueText(swap.payment_due_at)}
          </span>
        </>
      )}
      <Button size="sm" variant="outline" data-testid={`swap-cancel-${swap.id}`} disabled={act.isPending} onClick={() => act.mutate("cancel")} className="rounded-full">
        Cancel
      </Button>
    </>
  );
}

/** Owner side: accept/decline a pending offer, or wait for the proposer's fee. */
function OwnerActions({ swap }: { swap: Swap }) {
  const act = useSwapAction(swap.id);
  if (swap.status === "awaiting_payment") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-600" data-testid={`swap-waiting-fee-${swap.id}`}>
        <Clock className="size-3.5" /> Waiting for {swap.proposer_name.split(" ")[0]} to pay the fee · {dueText(swap.payment_due_at)}
      </span>
    );
  }
  return (
    <>
      <Button size="sm" data-testid={`swap-accept-${swap.id}`} disabled={act.isPending} onClick={() => act.mutate("accept")} className="rounded-full">
        <Check className="size-4" /> Accept
      </Button>
      <Button size="sm" variant="outline" data-testid={`swap-decline-${swap.id}`} disabled={act.isPending} onClick={() => act.mutate("decline")} className="rounded-full">
        <X className="size-4" /> Decline
      </Button>
    </>
  );
}

function ConfirmedActions({ swap }: { swap: Swap }) {
  return (
    <>
      <Link to={`/swaps/${swap.id}/chat`} data-testid={`swap-chat-${swap.id}`} className="brutal brutal-hover inline-flex items-center gap-1 rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-bold text-slate-900">
        <MessageCircle className="size-3.5" /> Chat
      </Link>
      {swap.counterpart_email && (
        <a href={`mailto:${swap.counterpart_email}`} data-testid={`swap-contact-${swap.id}`} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
          <Mail className="size-3.5" /> {swap.counterpart_email}
        </a>
      )}
    </>
  );
}

function SwapActions({ swap, incoming }: { swap: Swap; incoming: boolean }) {
  const open = swap.status === "pending" || swap.status === "awaiting_payment";
  if (swap.status === "accepted") return <ConfirmedActions swap={swap} />;
  if (!open) return null;
  return incoming ? <OwnerActions swap={swap} /> : <ProposerActions swap={swap} />;
}

export default function SwapRow({ swap, incoming, viewerId }: { swap: Swap; incoming: boolean; viewerId: string | undefined }) {
  return (
    <div data-testid={`swap-row-${swap.id}`} className="brutal rounded-2xl bg-white p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <SwapSummary swap={swap} incoming={incoming} />
        <div className="flex flex-wrap items-center gap-2">
          <span data-testid={`swap-status-${swap.id}`} className={cn("rounded-full px-3 py-1 text-xs font-bold capitalize", STATUS_STYLE[swap.status])}>
            {STATUS_LABEL[swap.status]}
          </span>
          <SwapActions swap={swap} incoming={incoming} />
        </div>
      </div>
      {swap.status === "accepted" && (
        <div className="mt-4">
          <SwapProgress swap={swap} viewerId={viewerId} compact />
        </div>
      )}
    </div>
  );
}
