import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftRight, Bell, Check, Coins, Mail, MessageCircle, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { CreditTx, Item, SavedSearch, Swap, SwapLists } from "@/lib/types";
import SwapProgress from "@/components/SwapProgress";
import { errorMessage, useMe } from "@/lib/hooks";
import ItemCard from "@/components/ItemCard";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<Swap["status"], string> = {
  pending: "bg-amber-100 text-amber-900",
  accepted: "bg-emerald-100 text-emerald-900",
  declined: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-600",
};

function SwapRow({ swap, incoming, viewerId }: { swap: Swap; incoming: boolean; viewerId: string | undefined }) {
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: (action: "accept" | "decline" | "cancel") => apiPost<Swap>(`/swaps/${swap.id}/${action}`),
    onSuccess: (_s, action) => {
      qc.invalidateQueries({ queryKey: ["swaps"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["credit-history"] });
      toast.success(action === "accept" ? "Swap accepted! Time to pack your item 📦" : `Offer ${action}ed`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  // what *I* give / get
  const give = incoming ? swap.target_item : swap.offered_item;
  const get = incoming ? swap.offered_item : swap.target_item;
  const myCost = incoming ? swap.owner_cost : swap.proposer_cost;
  const other = incoming ? swap.proposer_name : swap.owner_name;

  return (
    <div data-testid={`swap-row-${swap.id}`} className="brutal rounded-2xl bg-white p-4">
     <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
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
            {incoming ? "From" : "To"} {other} · you pay <strong>{myCost}</strong> cr
          </p>
          {swap.message && <p className="mt-1 truncate text-xs italic text-slate-500">"{swap.message}"</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span data-testid={`swap-status-${swap.id}`} className={cn("rounded-full px-3 py-1 text-xs font-bold capitalize", STATUS_STYLE[swap.status])}>
          {swap.status}
        </span>
        {swap.status === "pending" && incoming && (
          <>
            <Button size="sm" data-testid={`swap-accept-${swap.id}`} disabled={act.isPending} onClick={() => act.mutate("accept")} className="rounded-full">
              <Check className="size-4" /> Accept
            </Button>
            <Button size="sm" variant="outline" data-testid={`swap-decline-${swap.id}`} disabled={act.isPending} onClick={() => act.mutate("decline")} className="rounded-full">
              <X className="size-4" /> Decline
            </Button>
          </>
        )}
        {swap.status === "pending" && !incoming && (
          <Button size="sm" variant="outline" data-testid={`swap-cancel-${swap.id}`} disabled={act.isPending} onClick={() => act.mutate("cancel")} className="rounded-full">
            Cancel
          </Button>
        )}
        {swap.status === "accepted" && (
          <Link to={`/swaps/${swap.id}/chat`} data-testid={`swap-chat-${swap.id}`} className="brutal brutal-hover inline-flex items-center gap-1 rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-bold text-slate-900">
            <MessageCircle className="size-3.5" /> Chat
          </Link>
        )}
        {swap.status === "accepted" && swap.counterpart_email && (
          <a href={`mailto:${swap.counterpart_email}`} data-testid={`swap-contact-${swap.id}`} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
            <Mail className="size-3.5" /> {swap.counterpart_email}
          </a>
        )}
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

function searchHref(s: Pick<SavedSearch, "q" | "category" | "location">) {
  const sp = new URLSearchParams();
  if (s.q) sp.set("q", s.q);
  if (s.category) sp.set("category", s.category);
  if (s.location) sp.set("location", s.location);
  return `/browse?${sp.toString()}`;
}

function SavedSearches() {
  const qc = useQueryClient();
  const { data, isError } = useQuery({ queryKey: ["saved-searches"], queryFn: () => apiGet<SavedSearch[]>("/saved-searches") });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/saved-searches/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
      toast.success("Saved search removed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const list = isError ? [] : (data ?? []);
  if (list.length === 0)
    return <Empty testid="saved-empty" text='No saved searches yet. Search for something like "camera" in Dublin on Browse and tap "Save search" to get alerts.' />;
  return (
    <div className="space-y-3">
      {list.map((s) => (
        <div key={s.id} data-testid={`saved-search-${s.id}`} className="brutal flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4">
          <span className="grid size-10 place-items-center rounded-full border-2 border-slate-900 bg-pink-200">
            <Bell className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {s.q ? `"${s.q}"` : "Anything"}
              {s.category && <span className="font-normal text-slate-600"> in {s.category}</span>}
              {s.location && <span className="font-normal text-slate-600"> near {s.location}</span>}
            </p>
            <p className="text-xs text-slate-500">You'll get an alert when a matching item is listed</p>
          </div>
          <Link to={searchHref(s)} data-testid={`saved-search-view-${s.id}`} className="inline-flex items-center gap-1 rounded-full border-2 border-slate-900 px-3 py-1.5 text-xs font-bold hover:bg-slate-50">
            <Search className="size-3.5" /> View matches
          </Link>
          <Button size="icon-sm" variant="ghost" aria-label="Delete saved search" data-testid={`saved-search-delete-${s.id}`} disabled={del.isPending} onClick={() => del.mutate(s.id)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function Empty({ text, testid }: { text: string; testid: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center text-slate-600" data-testid={testid}>
      {text}
    </div>
  );
}

export default function Dashboard() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "incoming";
  const swaps = useQuery({ queryKey: ["swaps"], queryFn: () => apiGet<SwapLists>("/swaps") });
  const mine = useQuery({ queryKey: ["items", "mine"], queryFn: () => apiGet<Item[]>("/items/mine") });
  const history = useQuery({ queryKey: ["credit-history"], queryFn: () => apiGet<CreditTx[]>("/credits/history") });
  const incoming = swaps.isError ? [] : (swaps.data?.incoming ?? []);
  const outgoing = swaps.isError ? [] : (swaps.data?.outgoing ?? []);
  const pendingIn = incoming.filter((s) => s.status === "pending").length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Dashboard</p>
          <h1 className="mt-1 text-4xl font-extrabold text-slate-900 sm:text-5xl" data-testid="dashboard-greeting">
            Hey {me?.name.split(" ")[0] ?? "swapper"} 👋
          </h1>
          <p className="mt-2 text-slate-600">
            {pendingIn > 0 ? `You have ${pendingIn} swap offer${pendingIn > 1 ? "s" : ""} waiting for you.` : "Here's everything happening with your swaps."}
          </p>
        </div>
        <div className="brutal relative overflow-hidden rounded-3xl bg-amber-300 p-6" data-testid="wallet-card">
          <Coins className="absolute -right-4 -top-4 size-28 text-amber-500/40" />
          <p className="text-xs font-bold uppercase tracking-[0.18em]">Swap wallet</p>
          <p className="mt-1 font-heading text-5xl font-extrabold" data-testid="wallet-balance">{me?.credits ?? 0}</p>
          <p className="text-sm font-semibold">credits available</p>
          <div className="mt-4 flex gap-2">
            <Link to="/credits" data-testid="wallet-buy-credits" className="brutal brutal-hover rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">
              Buy credits
            </Link>
            <Link to="/list" data-testid="wallet-list-item" className="brutal brutal-hover inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-bold">
              <Plus className="size-4" /> List item
            </Link>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: String(v) })} className="mt-12">
        <TabsList className="h-auto flex-wrap gap-1 rounded-full border-2 border-slate-900 bg-white p-1">
          <TabsTrigger value="incoming" data-testid="tab-incoming" className="rounded-full px-4 py-1.5 data-active:bg-slate-900 data-active:text-white">
            Offers for me {pendingIn > 0 && `(${pendingIn})`}
          </TabsTrigger>
          <TabsTrigger value="outgoing" data-testid="tab-outgoing" className="rounded-full px-4 py-1.5 data-active:bg-slate-900 data-active:text-white">
            My offers
          </TabsTrigger>
          <TabsTrigger value="listings" data-testid="tab-listings" className="rounded-full px-4 py-1.5 data-active:bg-slate-900 data-active:text-white">
            My listings
          </TabsTrigger>
          <TabsTrigger value="saved" data-testid="tab-saved" className="rounded-full px-4 py-1.5 data-active:bg-slate-900 data-active:text-white">
            Saved searches
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history" className="rounded-full px-4 py-1.5 data-active:bg-slate-900 data-active:text-white">
            Credit history
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="mt-6 space-y-4">
          {incoming.length === 0 ? <Empty testid="incoming-empty" text="No offers yet — list more items to get noticed!" /> : incoming.map((s) => <SwapRow key={s.id} swap={s} incoming viewerId={me?.user_id} />)}
        </TabsContent>
        <TabsContent value="outgoing" className="mt-6 space-y-4">
          {outgoing.length === 0 ? <Empty testid="outgoing-empty" text="You haven't proposed any swaps yet. Go browse!" /> : outgoing.map((s) => <SwapRow key={s.id} swap={s} incoming={false} viewerId={me?.user_id} />)}
        </TabsContent>
        <TabsContent value="listings" className="mt-6">
          {(mine.data ?? []).length === 0 || mine.isError ? (
            <Empty testid="listings-empty" text="No listings yet. What's gathering dust at home?" />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {(mine.data ?? []).map((it, i) => (
                <div key={it.id} className="relative">
                  <ItemCard item={it} index={i} />
                  {it.status === "swapped" && (
                    <span className="absolute right-3 bottom-3 rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-bold text-white">Swapped</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="saved" className="mt-6">
          <SavedSearches />
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          {(history.data ?? []).length === 0 || history.isError ? (
            <Empty testid="history-empty" text="No credit activity yet." />
          ) : (
            <div className="brutal divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white">
              {(history.data ?? []).map((t) => (
                <div key={t.id} data-testid={`credit-tx-${t.id}`} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold">{t.reason}</p>
                    <p className="text-xs text-slate-500">{new Date(t.created_at).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  <span className={cn("font-heading text-lg font-extrabold", t.amount > 0 ? "text-emerald-700" : "text-red-700")}>
                    {t.amount > 0 ? "+" : ""}
                    {t.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
