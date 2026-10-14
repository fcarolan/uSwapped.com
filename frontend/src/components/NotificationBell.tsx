import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftRight, Bell, BellRing, Check, MessageCircle, PackageCheck, PartyPopper, Search, Star, Truck, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiGet, apiPost } from "@/lib/api";
import type { Notification, NotificationKind, NotificationList } from "@/lib/types";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationKind, typeof Bell> = {
  swap_offer: ArrowLeftRight,
  swap_accepted: Check,
  swap_declined: X,
  message: MessageCircle,
  swap_posted: Truck,
  swap_received: PackageCheck,
  rating: Star,
  saved_search: Search,
  swap_confirmed: PartyPopper,
};
const ICON_BG: Record<NotificationKind, string> = {
  swap_offer: "bg-amber-200",
  swap_accepted: "bg-emerald-200",
  swap_declined: "bg-slate-200",
  message: "bg-sky-200",
  swap_posted: "bg-sky-200",
  swap_received: "bg-emerald-200",
  rating: "bg-amber-200",
  saved_search: "bg-pink-200",
  swap_confirmed: "bg-emerald-300",
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
  }, []);
  if (state === null || state === "unsupported") return null;
  if (state === "ios-needs-install")
    return (
      <p className="rounded-xl bg-amber-50 p-3 text-xs text-slate-700" data-testid="push-ios-hint">
        📲 To get phone alerts on iPhone, add USwapped to your Home Screen (Share → Add to Home Screen), then open it from there.
      </p>
    );
  if (state === "denied")
    return (
      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600" data-testid="push-denied-hint">
        Phone alerts are blocked. Allow notifications for USwapped in your browser or phone settings.
      </p>
    );
  return (
    <button
      type="button"
      data-testid="push-toggle-button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const next = state === "on" ? await disablePush() : await enablePush();
          setState(next);
          if (next === "on") toast.success("Phone alerts are on 🔔");
        } catch {
          toast.error("Couldn't turn on alerts on this device");
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 py-2 text-xs font-bold transition-colors duration-150",
        state === "on" ? "bg-white hover:bg-slate-50" : "bg-emerald-400 hover:bg-emerald-300",
      )}
    >
      <BellRing className="size-4" /> {state === "on" ? "Phone alerts on · turn off" : "Turn on phone alerts"}
    </button>
  );
}

export default function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data, isError } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<NotificationList>("/notifications"),
    refetchInterval: 20_000,
  });
  const unread = isError ? 0 : (data?.unread ?? 0);
  const items = isError ? [] : (data?.items ?? []);

  const readAll = useMutation({
    mutationFn: () => apiPost("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const openItem = async (n: Notification) => {
    setOpen(false);
    if (!n.read) {
      await apiPost(`/notifications/${n.id}/read`).catch(() => {});
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    qc.invalidateQueries({ queryKey: ["swaps"] });
    navigate(n.link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-testid="notification-bell"
        aria-label="Notifications"
        className="brutal relative grid size-9 place-items-center rounded-full bg-white transition-transform duration-150 active:scale-90"
      >
        <Bell className={cn("size-4.5", unread > 0 && "animate-wiggle")} />
        {unread > 0 && (
          <span
            data-testid="notification-unread-count"
            className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full border-2 border-slate-900 bg-red-500 px-1 text-[10px] font-extrabold text-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] rounded-2xl border-2 border-slate-900 p-0" data-testid="notification-panel">
        <div className="flex items-center justify-between border-b-2 border-slate-900 px-4 py-3">
          <p className="font-heading font-extrabold">Notifications</p>
          {unread > 0 && (
            <button type="button" data-testid="notification-read-all" onClick={() => readAll.mutate()} className="text-xs font-bold text-emerald-700 hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500" data-testid="notification-empty">
              You're all caught up ✨
            </p>
          ) : (
            items.map((n) => {
              const Icon = ICONS[n.kind];
              return (
                <button
                  key={n.id}
                  type="button"
                  data-testid={`notification-item-${n.id}`}
                  onClick={() => void openItem(n)}
                  className={cn(
                    "flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50",
                    !n.read && "bg-emerald-50/60",
                  )}
                >
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border-2 border-slate-900", ICON_BG[n.kind])}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold">{n.title}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(n.created_at)}</span>
                    </span>
                    <span className="line-clamp-2 text-xs text-slate-600">{n.body}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500" />}
                </button>
              );
            })
          )}
        </div>
        <div className="p-3">
          <PushToggle />
        </div>
      </PopoverContent>
    </Popover>
  );
}
