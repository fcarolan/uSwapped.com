import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Check, ExternalLink, RotateCcw, Search, ShieldCheck, ShieldOff, Trash2, Undo2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { euro } from "@/lib/fees";
import { errorMessage } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import ConfirmAction from "@/components/admin/ConfirmAction";
import type {
  AdminActionResult, AdminStats, AdminTransaction, AdminUser, AuditEntry, Item, RemoveItemBody, Report, ReportResolve,
  RoleBody, SuspendBody, Swap,
} from "@/lib/types";

const date = (iso: string) => new Date(iso).toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** One mutation helper for every admin action: toast the server's message and refresh admin data. */
function useAdminAction<V>(fn: (v: V) => Promise<AdminActionResult | Report>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("detail" in r && r.detail ? r.detail : "Done");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "pink" | "sky" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-900",
    amber: "bg-amber-100 text-amber-900",
    red: "bg-red-100 text-red-800",
    pink: "bg-pink-100 text-pink-900",
    sky: "bg-sky-100 text-sky-900",
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize", tones[tone])}>{children}</span>;
}

function SearchBox({ value, onChange, placeholder, testid }: { value: string; onChange: (v: string) => void; placeholder: string; testid: string }) {
  return (
    <div className="relative max-w-sm flex-1">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 rounded-full border-2 border-slate-900 bg-white pl-9" />
    </div>
  );
}

function Filter<T extends string>({ value, options, onChange, testid }: { value: T; options: T[]; onChange: (v: T) => void; testid: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testid}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          data-testid={`${testid}-${o}`}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-full border-2 px-3 py-1 text-xs font-bold capitalize transition-colors duration-150",
            value === o ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-slate-900",
          )}
        >
          {o.replace("_", " ")}
        </button>
      ))}
    </div>
  );
}

function Panel({ children, testid }: { children: ReactNode; testid: string }) {
  return (
    <div className="brutal overflow-hidden rounded-2xl bg-white" data-testid={testid}>
      {children}
    </div>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-10 text-center text-sm text-slate-500">
        {text}
      </TableCell>
    </TableRow>
  );
}

// ---------------- Overview ----------------
export function OverviewPanel() {
  const { data, isError } = useQuery({ queryKey: ["admin", "stats"], queryFn: () => apiGet<AdminStats>("/admin/stats") });
  const s = isError ? undefined : data;
  const cards = [
    { label: "Members", value: s?.users, sub: `${s?.suspended_users ?? 0} suspended`, bg: "bg-emerald-200", id: "users" },
    { label: "Live listings", value: s?.items_available, sub: `${s?.items_removed ?? 0} removed`, bg: "bg-sky-200", id: "listings" },
    { label: "Open reports", value: s?.open_reports, sub: "need review", bg: "bg-pink-200", id: "reports" },
    { label: "Revenue", value: s ? euro(s.revenue_cents) : undefined, sub: `${s ? euro(s.refunded_cents) : "€0"} refunded`, bg: "bg-amber-200", id: "revenue" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.id} className={cn("brutal rounded-2xl p-5", c.bg)} data-testid={`admin-stat-${c.id}`}>
            <p className="text-xs font-bold uppercase tracking-[0.16em]">{c.label}</p>
            <p className="mt-1 font-heading text-4xl font-extrabold">{c.value ?? "—"}</p>
            <p className="text-xs font-semibold text-slate-700">{c.sub}</p>
          </div>
        ))}
      </div>
      <Panel testid="admin-swap-breakdown">
        <div className="flex flex-wrap gap-6 p-5">
          {Object.entries(s?.swaps_by_status ?? {}).map(([k, v]) => (
            <div key={k} data-testid={`admin-swaps-${k}`}>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{k.replace("_", " ")} swaps</p>
              <p className="font-heading text-2xl font-extrabold">{v}</p>
            </div>
          ))}
          {Object.keys(s?.swaps_by_status ?? {}).length === 0 && <p className="text-sm text-slate-500">No swaps yet.</p>}
        </div>
      </Panel>
    </div>
  );
}

// ---------------- Reports ----------------
const REPORT_FILTERS = ["open", "item_removed", "dismissed", "all"] as const;
type ReportFilter = (typeof REPORT_FILTERS)[number];

export function ReportsPanel() {
  const [status, setStatus] = useState<ReportFilter>("open");
  const { data, isError, isPending } = useQuery({ queryKey: ["admin", "reports", status], queryFn: () => apiGet<Report[]>(`/admin/reports?status=${status}`) });
  const resolve = useAdminAction(({ id, action }: { id: string } & ReportResolve) => apiPost<Report>(`/admin/reports/${id}/resolve`, { action }));
  const rows = isError ? [] : (data ?? []);
  return (
    <div className="space-y-4">
      <Filter value={status} options={[...REPORT_FILTERS]} onChange={setStatus} testid="admin-report-filter" />
      <Panel testid="admin-reports-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Listing</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Reported by</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <EmptyRow cols={5} text={isPending ? "Loading…" : "No reports here. 🎉"} />}
            {rows.map((r) => (
              <TableRow key={r.id} data-testid={`admin-report-${r.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <img src={r.item_image_url} alt="" className="size-10 rounded-lg border border-slate-300 object-cover" />
                    <div>
                      <p className="font-semibold">{r.item_title}</p>
                      <p className="text-xs text-slate-500">by {r.item_owner_name}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Pill tone="red">{r.reason}</Pill>
                  {r.details && <p className="mt-1 max-w-xs whitespace-normal text-xs text-slate-600">"{r.details}"</p>}
                </TableCell>
                <TableCell className="text-sm">{r.reporter_name}</TableCell>
                <TableCell className="text-xs text-slate-500">{date(r.created_at)}</TableCell>
                <TableCell className="text-right">
                  {r.status === "open" ? (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="destructive" data-testid={`admin-report-remove-${r.id}`} disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, action: "remove_item" })}>
                        <Trash2 className="size-3.5" /> Remove listing
                      </Button>
                      <Button size="sm" variant="outline" data-testid={`admin-report-dismiss-${r.id}`} disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, action: "dismiss" })}>
                        <Check className="size-3.5" /> Dismiss
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">
                      <Pill tone={r.status === "dismissed" ? "slate" : "red"}>{r.status.replace("_", " ")}</Pill> by {r.resolved_by}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

// ---------------- Listings ----------------
const ITEM_FILTERS = ["all", "available", "reserved", "swapped", "removed"] as const;
type ItemFilter = (typeof ITEM_FILTERS)[number];
const ITEM_TONE = { available: "green", reserved: "pink", swapped: "sky", removed: "red" } as const;

export function ListingsPanel() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ItemFilter>("all");
  const { data, isError, isPending } = useQuery({
    queryKey: ["admin", "items", q, status],
    queryFn: () => apiGet<Item[]>(`/admin/items?status=${status}&q=${encodeURIComponent(q)}`),
  });
  const remove = useAdminAction(({ id, reason }: { id: string } & RemoveItemBody) => apiPost<AdminActionResult>(`/admin/items/${id}/remove`, { reason }));
  const restore = useAdminAction((id: string) => apiPost<AdminActionResult>(`/admin/items/${id}/restore`));
  const rows = isError ? [] : (data ?? []);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search title, owner, location…" testid="admin-items-search" />
        <Filter value={status} options={[...ITEM_FILTERS]} onChange={setStatus} testid="admin-items-filter" />
      </div>
      <Panel testid="admin-items-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Listing</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <EmptyRow cols={5} text={isPending ? "Loading…" : "No listings match."} />}
            {rows.map((it) => (
              <TableRow key={it.id} data-testid={`admin-item-${it.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <img src={it.image_url} alt="" className="size-10 rounded-lg border border-slate-300 object-cover" />
                    <div>
                      <p className="font-semibold">{it.title}</p>
                      <p className="text-xs text-slate-500">{it.category} · {it.location}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{it.owner_name}</TableCell>
                <TableCell className="font-mono text-sm">€{it.value_eur}</TableCell>
                <TableCell>
                  <Pill tone={ITEM_TONE[it.status]}>{it.status}</Pill>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {it.status !== "removed" && (
                      <Link to={`/items/${it.id}`} target="_blank" className="inline-flex items-center rounded-md px-2 text-slate-500 hover:text-slate-900" aria-label="Open listing" data-testid={`admin-item-open-${it.id}`}>
                        <ExternalLink className="size-4" />
                      </Link>
                    )}
                    {it.status === "removed" ? (
                      <Button size="sm" variant="outline" data-testid={`admin-item-restore-${it.id}`} disabled={restore.isPending} onClick={() => restore.mutate(it.id)}>
                        <Undo2 className="size-3.5" /> Restore
                      </Button>
                    ) : (
                      <ConfirmAction
                        testid={`admin-item-remove-${it.id}`}
                        size="sm"
                        triggerVariant="destructive"
                        destructive
                        disabled={remove.isPending}
                        trigger={<><Trash2 className="size-3.5" /> Remove</>}
                        title={`Remove "${it.title}"?`}
                        description="It disappears from Browse and any open offers on it are cancelled. The owner is notified with your reason."
                        inputLabel="Reason shown to the owner"
                        defaultInput="Breaks USwapped listing rules"
                        confirmLabel="Remove listing"
                        onConfirm={(reason) => remove.mutate({ id: it.id, reason: reason || "Breaks USwapped listing rules" })}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

// ---------------- Users ----------------
function UserActions({ u, selfId }: { u: AdminUser; selfId: string | undefined }) {
  const suspend = useAdminAction((b: SuspendBody) => apiPost<AdminActionResult>(`/admin/users/${u.user_id}/suspend`, b));
  const role = useAdminAction((b: RoleBody) => apiPost<AdminActionResult>(`/admin/users/${u.user_id}/role`, b));
  const listings = useAdminAction<void>(() => apiPost<AdminActionResult>(`/admin/users/${u.user_id}/remove-listings`));
  const del = useAdminAction<void>(() => apiDelete<AdminActionResult>(`/admin/users/${u.user_id}`));
  if (u.user_id === selfId) return <span className="text-xs text-slate-400">You</span>;
  const busy = suspend.isPending || role.isPending || listings.isPending || del.isPending;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button size="xs" variant="outline" data-testid={`admin-user-suspend-${u.user_id}`} disabled={busy} onClick={() => suspend.mutate({ suspended: !u.suspended })}>
        {u.suspended ? <><RotateCcw className="size-3" /> Unsuspend</> : <><Ban className="size-3" /> Suspend</>}
      </Button>
      <ConfirmAction
        testid={`admin-user-role-${u.user_id}`}
        disabled={busy}
        trigger={u.role === "admin" ? <><ShieldOff className="size-3" /> Revoke admin</> : <><ShieldCheck className="size-3" /> Make admin</>}
        title={u.role === "admin" ? `Remove admin access from ${u.name}?` : `Make ${u.name} an admin?`}
        description={u.role === "admin" ? "They'll go back to being a regular member." : "They'll get full access to this admin portal, including refunds and deleting accounts."}
        confirmLabel={u.role === "admin" ? "Revoke admin" : "Make admin"}
        onConfirm={() => role.mutate({ role: u.role === "admin" ? "user" : "admin" })}
      />
      <ConfirmAction
        testid={`admin-user-remove-listings-${u.user_id}`}
        disabled={busy || u.listings === 0}
        destructive
        trigger={<><Trash2 className="size-3" /> Listings</>}
        title={`Remove all ${u.listings} listings by ${u.name}?`}
        description="Their items disappear from Browse and open offers on them are cancelled. You can restore items one by one from the Listings tab."
        confirmLabel="Remove all listings"
        onConfirm={() => listings.mutate()}
      />
      <ConfirmAction
        testid={`admin-user-delete-${u.user_id}`}
        triggerVariant="destructive"
        destructive
        disabled={busy}
        trigger={<><UserX className="size-3" /> Delete</>}
        title={`Permanently delete ${u.email}?`}
        description="This removes their account, listings, saved searches and notifications. It can't be undone. Payment records are kept for accounting."
        requireText="DELETE"
        confirmLabel="Delete account"
        onConfirm={() => del.mutate()}
      />
    </div>
  );
}

export function UsersPanel({ selfId }: { selfId: string | undefined }) {
  const [q, setQ] = useState("");
  const { data, isError, isPending } = useQuery({ queryKey: ["admin", "users", q], queryFn: () => apiGet<AdminUser[]>(`/admin/users?q=${encodeURIComponent(q)}`) });
  const rows = isError ? [] : (data ?? []);
  return (
    <div className="space-y-4">
      <SearchBox value={q} onChange={setQ} placeholder="Search name or email…" testid="admin-users-search" />
      <Panel testid="admin-users-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Sign-in</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <EmptyRow cols={5} text={isPending ? "Loading…" : "No members match."} />}
            {rows.map((u) => (
              <TableRow key={u.user_id} data-testid={`admin-user-${u.user_id}`}>
                <TableCell>
                  <p className="font-semibold">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </TableCell>
                <TableCell><Pill>{u.auth}</Pill></TableCell>
                <TableCell className="text-xs text-slate-600">
                  {u.listings} listings · {u.swaps} swaps
                  {u.rating_avg !== null && <> · ⭐ {u.rating_avg.toFixed(1)} ({u.rating_count})</>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {u.role === "admin" && <Pill tone="amber">admin</Pill>}
                    {u.suspended ? <Pill tone="red">suspended</Pill> : <Pill tone="green">active</Pill>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <UserActions u={u} selfId={selfId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

// ---------------- Swaps ----------------
const SWAP_FILTERS = ["all", "pending", "awaiting_payment", "accepted", "declined", "cancelled", "expired"] as const;
type SwapFilter = (typeof SWAP_FILTERS)[number];
const SWAP_TONE = { pending: "amber", awaiting_payment: "pink", accepted: "green", declined: "red", cancelled: "slate", expired: "slate" } as const;

export function SwapsPanel() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<SwapFilter>("all");
  const { data, isError, isPending } = useQuery({
    queryKey: ["admin", "swaps", q, status],
    queryFn: () => apiGet<Swap[]>(`/admin/swaps?status=${status}&q=${encodeURIComponent(q)}`),
  });
  const cancel = useAdminAction((id: string) => apiPost<AdminActionResult>(`/admin/swaps/${id}/cancel`));
  const rows = isError ? [] : (data ?? []);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search member or item…" testid="admin-swaps-search" />
        <Filter value={status} options={[...SWAP_FILTERS]} onChange={setStatus} testid="admin-swaps-filter" />
      </div>
      <Panel testid="admin-swaps-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requested by → owner</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Postage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <EmptyRow cols={6} text={isPending ? "Loading…" : "No swaps match."} />}
            {rows.map((s) => (
              <TableRow key={s.id} data-testid={`admin-swap-${s.id}`}>
                <TableCell className="text-sm">
                  <p className="font-semibold">{s.proposer_name}</p>
                  <p className="text-xs text-slate-500">→ {s.owner_name} · {date(s.created_at)}</p>
                </TableCell>
                <TableCell className="max-w-xs whitespace-normal text-xs">
                  <strong>{s.offered_item.title}</strong> for <strong>{s.target_item.title}</strong>
                </TableCell>
                <TableCell className="text-sm">
                  {euro(s.fee_cents)} {s.fee_paid && <Pill tone="green">paid</Pill>}
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {s.status === "accepted"
                    ? `${s.proposer_posted_at ? "📦" : "—"} / ${s.owner_posted_at ? "📦" : "—"} sent · ${s.proposer_received_at ? "✅" : "—"} / ${s.owner_received_at ? "✅" : "—"} received`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Pill tone={SWAP_TONE[s.status]}>{s.status.replace("_", " ")}</Pill>
                </TableCell>
                <TableCell className="text-right">
                  {(s.status === "pending" || s.status === "awaiting_payment") && (
                    <ConfirmAction
                      testid={`admin-swap-cancel-${s.id}`}
                      disabled={cancel.isPending}
                      destructive
                      trigger="Cancel swap"
                      title="Cancel this swap?"
                      description="Both members' reserved items go back on the market."
                      confirmLabel="Cancel swap"
                      onConfirm={() => cancel.mutate(s.id)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

// ---------------- Transactions ----------------
const TX_TONE: Record<string, "green" | "amber" | "slate" | "red"> = { paid: "green", pending: "amber", refunded: "slate", expired: "red" };

export function TransactionsPanel() {
  const { data, isError, isPending } = useQuery({ queryKey: ["admin", "transactions"], queryFn: () => apiGet<AdminTransaction[]>("/admin/transactions") });
  const refund = useAdminAction((sessionId: string) => apiPost<AdminActionResult>(`/admin/transactions/${sessionId}/refund`));
  const rows = isError ? [] : (data ?? []);
  return (
    <Panel testid="admin-transactions-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Member</TableHead>
            <TableHead>What</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <EmptyRow cols={6} text={isPending ? "Loading…" : "No transactions yet."} />}
          {rows.map((t) => (
            <TableRow key={t.session_id} data-testid={`admin-tx-${t.session_id}`}>
              <TableCell className="text-xs text-slate-500">{date(t.created_at)}</TableCell>
              <TableCell className="text-sm">
                <p className="font-semibold">{t.user_name ?? "Deleted user"}</p>
                <p className="text-xs text-slate-500">{t.user_email}</p>
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal text-xs">
                <Pill tone={t.kind === "label" ? "sky" : "pink"}>{t.kind === "label" ? "label" : "swap fee"}</Pill> {t.description}
              </TableCell>
              <TableCell className="font-heading font-extrabold">{euro(t.amount_cents)}</TableCell>
              <TableCell>
                <Pill tone={TX_TONE[t.payment_status] ?? "slate"}>{t.payment_status}</Pill>
              </TableCell>
              <TableCell className="text-right">
                {t.refundable ? (
                  <ConfirmAction
                    testid={`admin-tx-refund-${t.session_id}`}
                    disabled={refund.isPending}
                    destructive
                    trigger={<><RotateCcw className="size-3" /> Refund</>}
                    title={`Refund ${euro(t.amount_cents)}?`}
                    description={`Real money will be returned to ${t.user_name ?? "this member"}'s card through Stripe. The swap itself stays as it is.`}
                    confirmLabel="Issue refund"
                    onConfirm={() => refund.mutate(t.session_id)}
                  />
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

// ---------------- Audit log ----------------
export function AuditPanel() {
  const { data, isError, isPending } = useQuery({ queryKey: ["admin", "audit"], queryFn: () => apiGet<AuditEntry[]>("/admin/audit") });
  const rows = isError ? [] : (data ?? []);
  return (
    <Panel testid="admin-audit-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <EmptyRow cols={4} text={isPending ? "Loading…" : "No admin actions yet."} />}
          {rows.map((a) => (
            <TableRow key={a.id} data-testid={`admin-audit-${a.id}`}>
              <TableCell className="text-xs text-slate-500">{date(a.created_at)}</TableCell>
              <TableCell className="text-sm font-semibold">{a.admin_name}</TableCell>
              <TableCell><Pill>{a.action.replaceAll("_", " ")}</Pill></TableCell>
              <TableCell className="max-w-sm whitespace-normal text-xs">
                {a.target} {a.detail && <span className="text-slate-500">· {a.detail}</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
