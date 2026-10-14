import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Download, PackageCheck, Star, Tag, Truck } from "lucide-react";
import LabelDialog from "@/components/LabelDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiPost } from "@/lib/api";
import type { PostedUpdate, Rating, RatingCreate, Swap } from "@/lib/types";
import { errorMessage } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/** Derives "my" vs "their" side of an accepted swap for the viewer. */
export function swapSides(swap: Swap, viewerId: string | undefined) {
  const iAmProposer = swap.proposer_id === viewerId;
  return {
    otherName: iAmProposer ? swap.owner_name : swap.proposer_name,
    myPosted: iAmProposer ? swap.proposer_posted_at : swap.owner_posted_at,
    myTracking: iAmProposer ? swap.proposer_tracking : swap.owner_tracking,
    theirPosted: iAmProposer ? swap.owner_posted_at : swap.proposer_posted_at,
    theirTracking: iAmProposer ? swap.owner_tracking : swap.proposer_tracking,
    myReceived: iAmProposer ? swap.proposer_received_at : swap.owner_received_at,
    theirReceived: iAmProposer ? swap.owner_received_at : swap.proposer_received_at,
    iRated: iAmProposer ? swap.proposer_rated : swap.owner_rated,
    myName: iAmProposer ? swap.proposer_name : swap.owner_name,
    myLabelId: iAmProposer ? swap.proposer_label_id : swap.owner_label_id,
  };
}

type Sides = ReturnType<typeof swapSides>;

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short" }) : "");

function useRefreshSwap(swapId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["swaps"] });
    qc.invalidateQueries({ queryKey: ["swap", swapId] });
  };
}

function Step({ done, label, sub, testid }: { done: boolean; label: string; sub?: string; testid: string }) {
  return (
    <li className="flex items-start gap-2.5" data-testid={testid} data-done={done}>
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 border-slate-900 transition-colors duration-300",
          done ? "bg-emerald-400" : "bg-white",
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className={cn("block text-xs font-bold", done ? "text-slate-900" : "text-slate-500")}>{label}</span>
        {sub && <span className="block truncate text-[11px] text-slate-500">{sub}</span>}
      </span>
    </li>
  );
}

function Steps({ s, first }: { s: Sides; first: string }) {
  return (
    <ol className="mt-3 grid gap-2.5 sm:grid-cols-2">
      <Step testid="step-my-posted" done={!!s.myPosted} label={s.myPosted ? `You posted · ${fmt(s.myPosted)}` : "You post your item"} sub={s.myTracking ? `Tracking: ${s.myTracking}` : undefined} />
      <Step testid="step-their-posted" done={!!s.theirPosted} label={s.theirPosted ? `${first} posted · ${fmt(s.theirPosted)}` : `${first} posts their item`} sub={s.theirTracking ? `Tracking: ${s.theirTracking}` : undefined} />
      <Step testid="step-my-received" done={!!s.myReceived} label={s.myReceived ? `You received it · ${fmt(s.myReceived)}` : "You receive their item"} />
      <Step testid="step-their-received" done={!!s.theirReceived} label={s.theirReceived ? `${first} received it · ${fmt(s.theirReceived)}` : `${first} receives yours`} />
    </ol>
  );
}

function PostedDialog({ swapId, s, first, open, onOpenChange }: { swapId: string; s: Sides; first: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const refresh = useRefreshSwap(swapId);
  const [tracking, setTracking] = useState(s.myTracking ?? "");
  const posted = useMutation({
    mutationFn: (body: PostedUpdate) => apiPost<Swap>(`/swaps/${swapId}/posted`, body),
    onSuccess: () => {
      refresh();
      onOpenChange(false);
      toast.success(`Nice! ${first} has been told it's on the way 📦`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-2 border-slate-900">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Posted your item?</DialogTitle>
          <DialogDescription>Add a tracking number if you have one, so {first} can follow it.</DialogDescription>
        </DialogHeader>
        <Input
          data-testid="posted-tracking-input"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Tracking number (optional)"
          maxLength={80}
          className="h-11 rounded-xl border-2 border-slate-900"
        />
        <DialogFooter>
          <Button data-testid="posted-confirm-button" disabled={posted.isPending} onClick={() => posted.mutate({ tracking })} className="brutal brutal-hover rounded-full">
            <Truck className="size-4" /> {s.myPosted ? "Save tracking" : "Yes, it's on the way"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RateDialog({ swapId, first, open, onOpenChange }: { swapId: string; first: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const refresh = useRefreshSwap(swapId);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const rate = useMutation({
    mutationFn: (body: RatingCreate) => apiPost<Rating>(`/swaps/${swapId}/rating`, body),
    onSuccess: () => {
      refresh();
      onOpenChange(false);
      toast.success(`Thanks! Your rating for ${first} is live ⭐`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-2 border-slate-900">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">How was swapping with {first}?</DialogTitle>
          <DialogDescription>Your rating helps trusted swappers stand out.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-1.5" data-testid="rating-stars-input">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              data-testid={`rating-star-${i}`}
              onClick={() => setStars(i)}
              aria-label={`${i} stars`}
              className="transition-transform duration-150 hover:scale-110 active:scale-90"
            >
              <Star className={cn("size-9", i <= stars ? "fill-amber-400 text-amber-500" : "fill-slate-100 text-slate-300")} />
            </button>
          ))}
        </div>
        <Textarea
          data-testid="rating-comment-input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={300}
          placeholder="Packed well? Quick postage? (optional)"
          className="rounded-xl border-2 border-slate-900"
        />
        <DialogFooter>
          <Button data-testid="rating-submit-button" disabled={rate.isPending} onClick={() => rate.mutate({ stars, comment })} className="brutal brutal-hover rounded-full">
            Submit rating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LabelAction({ swapId, s, onBuy }: { swapId: string; s: Sides; onBuy: () => void }) {
  if (s.myLabelId) {
    return (
      <a
        href={`/api/labels/${s.myLabelId}/pdf`}
        target="_blank"
        rel="noreferrer"
        data-testid={`swap-download-label-${swapId}`}
        className="brutal brutal-hover inline-flex items-center gap-1.5 rounded-full bg-sky-200 px-3 py-1.5 text-xs font-bold text-slate-900"
      >
        <Download className="size-4" /> Download label <span className="rounded bg-amber-300 px-1 text-[10px]">DEMO</span>
      </a>
    );
  }
  if (s.myPosted) return null;
  return (
    <Button size="sm" variant="outline" data-testid={`swap-buy-label-${swapId}`} onClick={onBuy} className="rounded-full border-2 border-slate-900">
      <Tag className="size-4" /> Buy tracked label · from €5
    </Button>
  );
}

function ReceiveRateActions({ swapId, s, first, onRate }: { swapId: string; s: Sides; first: string; onRate: () => void }) {
  const refresh = useRefreshSwap(swapId);
  const received = useMutation({
    mutationFn: () => apiPost<Swap>(`/swaps/${swapId}/received`),
    onSuccess: () => {
      refresh();
      toast.success("Marked as received 🎉 Now rate your swap!");
      onRate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!s.myReceived) {
    return (
      <Button
        size="sm"
        variant={s.theirPosted ? "default" : "outline"}
        data-testid={`swap-mark-received-${swapId}`}
        disabled={received.isPending}
        onClick={() => received.mutate()}
        className={cn("rounded-full", s.theirPosted && "brutal brutal-hover bg-emerald-400 text-slate-900 hover:bg-emerald-300")}
      >
        <PackageCheck className="size-4" /> I received {first}'s item
      </Button>
    );
  }
  if (s.iRated) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold" data-testid={`swap-rated-${swapId}`}>
        <Star className="size-3.5 fill-amber-400 text-amber-500" /> You rated {first}
      </span>
    );
  }
  return (
    <Button size="sm" data-testid={`swap-rate-${swapId}`} onClick={onRate} className="brutal brutal-hover rounded-full bg-amber-300 text-slate-900 hover:bg-amber-200">
      <Star className="size-4" /> Rate {first}
    </Button>
  );
}

export default function SwapProgress({ swap, viewerId, compact = false }: { swap: Swap; viewerId: string | undefined; compact?: boolean }) {
  const s = swapSides(swap, viewerId);
  const first = s.otherName.split(" ")[0];
  const [postOpen, setPostOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const allDone = !!(s.myReceived && s.theirReceived);

  return (
    <div className={cn("rounded-2xl border-2 border-slate-900 bg-[#FAFAF7] p-4", compact && "p-3")} data-testid={`swap-progress-${swap.id}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-sm font-extrabold">{allDone ? "Swap complete 🎉" : "Postage tracker"}</p>
        {allDone && <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[11px] font-bold">Both received</span>}
      </div>
      <Steps s={s} first={first} />
      <div className="mt-4 flex flex-wrap gap-2">
        <LabelAction swapId={swap.id} s={s} onBuy={() => setLabelOpen(true)} />
        <Button
          size="sm"
          variant={s.myPosted ? "outline" : "default"}
          data-testid={s.myPosted ? `swap-edit-tracking-${swap.id}` : `swap-mark-posted-${swap.id}`}
          onClick={() => setPostOpen(true)}
          className={cn("rounded-full", !s.myPosted && "brutal brutal-hover")}
        >
          {s.myPosted ? (s.myTracking ? "Edit tracking" : "Add tracking number") : <><Truck className="size-4" /> I've posted my item</>}
        </Button>
        <ReceiveRateActions swapId={swap.id} s={s} first={first} onRate={() => setRateOpen(true)} />
      </div>

      {labelOpen && <LabelDialog open={labelOpen} onOpenChange={setLabelOpen} swapId={swap.id} myName={s.myName} otherName={s.otherName} />}
      {postOpen && <PostedDialog swapId={swap.id} s={s} first={first} open={postOpen} onOpenChange={setPostOpen} />}
      <RateDialog swapId={swap.id} first={first} open={rateOpen} onOpenChange={setRateOpen} />
    </div>
  );
}
