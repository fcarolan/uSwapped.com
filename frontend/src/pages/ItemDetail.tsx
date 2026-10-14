import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowLeftRight, MapPin, Repeat, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Item, Swap, SwapCreate } from "@/lib/types";
import { errorMessage, useMe } from "@/lib/hooks";
import ReportDialog from "@/components/ReportDialog";
import { eur, euro } from "@/lib/fees";
import { cn } from "@/lib/utils";
import { RatingInline, TrustBadge, isTrusted } from "@/components/Trust";

function ProposeDialog({ target }: { target: Item }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [offeredId, setOfferedId] = useState("");
  const [message, setMessage] = useState("");
  const { data: mine, isPending } = useQuery({ queryKey: ["items", "mine"], queryFn: () => apiGet<Item[]>("/items/mine"), enabled: open });
  const available = (mine ?? []).filter((i) => i.status === "available");
  const offered = available.find((i) => i.id === offeredId);

  const propose = useMutation({
    mutationFn: (body: SwapCreate) => apiPost<Swap>("/swaps", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swaps"] });
      toast.success("Swap proposed! We'll let you know when they reply.");
      setOpen(false);
      navigate("/dashboard?tab=outgoing");
    },
    onError: (e) => toast.error(errorMessage(e, "Couldn't propose the swap")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            data-testid="propose-swap-button"
            className="brutal brutal-hover h-14 w-full rounded-full text-base font-bold"
          />
        }
      >
        <ArrowLeftRight className="size-5" /> Propose a swap
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-2xl border-2 border-slate-900" data-testid="propose-swap-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-extrabold">Offer one of your items</DialogTitle>
          <DialogDescription>
            for <strong>{target.title}</strong>. Offers are free. You only pay the processing fee if {target.owner_name.split(" ")[0]} accepts.
          </DialogDescription>
        </DialogHeader>
        {isPending ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading your items…</p>
        ) : available.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center" data-testid="propose-no-items">
            <p className="font-semibold">You haven't listed anything to swap yet.</p>
            <Link to="/list" className="mt-3 inline-block text-sm font-bold text-emerald-700 underline" data-testid="propose-list-item-link">
              List an item first
            </Link>
          </div>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {available.map((i) => (
              <button
                key={i.id}
                type="button"
                data-testid={`propose-offer-option-${i.id}`}
                onClick={() => setOfferedId(i.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border-2 p-2 text-left transition-[border-color,background-color] duration-150",
                  offeredId === i.id ? "border-slate-900 bg-emerald-50" : "border-slate-200 hover:border-slate-400",
                )}
              >
                <img src={i.image_url} alt="" className="size-14 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{i.title}</p>
                  <p className="font-mono text-xs text-slate-500">est. {eur(i.value_eur)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {offered && (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-amber-50 p-4 text-sm" data-testid="propose-cost-breakdown">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Fee if accepted</p>
              <p className="font-heading text-2xl font-extrabold" data-testid="propose-you-pay">{euro(target.processing_fee_cents)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">They pay</p>
              <p className="font-heading text-2xl font-extrabold">€0.00</p>
            </div>
            <p className="col-span-2 flex items-start gap-2 text-xs text-slate-600">
              <Truck className="size-4 shrink-0" /> You'll each post your own item at your own cost. Tracked labels are optional.
            </p>
          </div>
        )}
        {available.length > 0 && (
          <Textarea
            data-testid="propose-message-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say hi! (optional)"
            maxLength={500}
          />
        )}
        <Button
          data-testid="propose-submit-button"
          disabled={!offered || propose.isPending}
          onClick={() => propose.mutate({ target_item_id: target.id, offered_item_id: offeredId, message })}
          className="h-12 rounded-full font-bold"
        >
          {propose.isPending ? "Sending…" : "Send swap offer"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Gallery({ item }: { item: Item }) {
  const photos = item.images.length ? item.images : [item.image_url];
  const [active, setActive] = useState(0);
  const current = photos[Math.min(active, photos.length - 1)];
  return (
    <div className="space-y-3">
      <div className="brutal overflow-hidden rounded-3xl bg-white">
        <img key={current} src={current} alt={item.title} className="aspect-[4/3] w-full animate-in fade-in object-cover duration-300" data-testid="item-image" />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-3" data-testid="item-gallery-thumbs">
          {photos.map((p, i) => (
            <button
              key={p}
              type="button"
              data-testid={`item-gallery-thumb-${i}`}
              onClick={() => setActive(i)}
              className={cn(
                "size-20 overflow-hidden rounded-xl border-2 transition-[border-color,transform] duration-150 active:scale-95",
                i === active ? "border-slate-900 shadow-[3px_3px_0_#0f172a]" : "border-slate-300 opacity-70 hover:opacity-100",
              )}
            >
              <img src={p} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ItemDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: item, isPending, isError } = useQuery({ queryKey: ["item", id], queryFn: () => apiGet<Item>(`/items/${id}`) });

  const del = useMutation({
    mutationFn: () => apiDelete(`/items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Listing removed");
      navigate("/dashboard?tab=listings");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Link to="/browse" data-testid="item-back-link" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Back to browse
      </Link>
      {isPending && <div className="mt-6 h-[420px] animate-pulse rounded-3xl bg-slate-100" />}
      {(isError || (!isPending && !item)) && (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center" data-testid="item-not-found">
          <p className="font-heading text-2xl font-bold">This item couldn't be loaded</p>
          <p className="mt-2 text-slate-600">It may have been swapped already.</p>
        </div>
      )}
      {item && !isError && (
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.25fr_1fr]">
          <Gallery item={item} />
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800">{item.category}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{item.condition}</span>
                {item.status === "swapped" && (
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800" data-testid="item-swapped-badge">Swapped</span>
                )}
              </div>
              <h1 className="mt-3 text-4xl font-extrabold leading-tight text-slate-900" data-testid="item-title">{item.title}</h1>
              <p className="mt-2 inline-flex items-center gap-1 text-sm text-slate-600">
                <MapPin className="size-4" /> {item.location}
              </p>
            </div>

            <div className="brutal grid grid-cols-2 rounded-2xl bg-amber-50">
              <div className="border-r-2 border-slate-900 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Estimated value</p>
                <p className="mt-1 font-heading text-3xl font-extrabold" data-testid="item-value">{eur(item.value_eur)}</p>
              </div>
              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Swap fee</p>
                <p className="mt-1 inline-flex items-center gap-1 font-heading text-3xl font-extrabold" data-testid="item-swap-fee">
                  <Repeat className="size-6 text-amber-600" /> {euro(item.processing_fee_cents)}
                </p>
                <p className="text-[11px] text-slate-500">only if your offer is accepted</p>
              </div>
            </div>

            <p className="whitespace-pre-line leading-relaxed text-slate-700" data-testid="item-description">{item.description}</p>

            <Link
              to={`/users/${item.owner_id}`}
              data-testid="item-owner-link"
              className="group flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 transition-colors duration-150 hover:border-slate-900"
            >
              <div className="grid size-11 place-items-center overflow-hidden rounded-full border-2 border-slate-900 bg-emerald-100">
                {item.owner_picture ? <img src={item.owner_picture} alt="" className="size-full object-cover" /> : item.owner_name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">Listed by</p>
                <p className="flex flex-wrap items-center gap-2 font-semibold" data-testid="item-owner-name">
                  {item.owner_name}
                  {isTrusted(item.owner_rating_avg, item.owner_rating_count) && <TrustBadge testid="item-owner-trusted" />}
                </p>
                <RatingInline avg={item.owner_rating_avg} count={item.owner_rating_count} testid="item-owner-rating" />
              </div>
              <span className="text-xs font-bold text-emerald-700 group-hover:underline">View profile →</span>
            </Link>

            {item.status === "available" &&
              (!me ? (
                <Button data-testid="item-signin-to-swap" onClick={() => navigate(`/login?next=/items/${item.id}`)} className="brutal brutal-hover h-14 w-full rounded-full text-base font-bold">
                  Sign in to propose a swap
                </Button>
              ) : me.user_id === item.owner_id ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-4">
                  <p className="text-sm font-semibold" data-testid="item-own-listing">This is your listing.</p>
                  <Button
                    variant="destructive"
                    data-testid="item-delete-button"
                    disabled={del.isPending}
                    onClick={() => {
                      if (window.confirm("Remove this listing?")) del.mutate();
                    }}
                  >
                    <Trash2 className="size-4" /> Remove
                  </Button>
                </div>
              ) : (
                <ProposeDialog target={item} />
              ))}
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <Truck className="size-4 shrink-0" /> Postage &amp; packaging is paid by each sender when swapping.
            </p>
            {me && me.user_id !== item.owner_id && <ReportDialog itemId={item.id} />}
          </div>
        </div>
      )}
    </div>
  );
}
