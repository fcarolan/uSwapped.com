import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, CreditCard, Flag, LayoutDashboard, Package, ScrollText, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { AdminStats } from "@/lib/types";
import {
  AuditPanel, ListingsPanel, OverviewPanel, ReportsPanel, SwapsPanel, TransactionsPanel, UsersPanel,
} from "@/components/admin/AdminPanels";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "reports", label: "Reports", icon: Flag },
  { id: "listings", label: "Listings", icon: Package },
  { id: "users", label: "Users", icon: Users },
  { id: "swaps", label: "Swaps", icon: ArrowLeftRight },
  { id: "transactions", label: "Transactions", icon: CreditCard },
  { id: "audit", label: "Audit log", icon: ScrollText },
] as const;

function NotAdmin() {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center" data-testid="admin-forbidden">
      <ShieldAlert className="mx-auto size-12 text-red-600" />
      <h1 className="mt-4 text-3xl font-extrabold">Admins only</h1>
      <p className="mt-2 text-slate-600">Your account doesn't have access to the admin portal.</p>
      <Link to="/" className="mt-6 inline-block rounded-full border-2 border-slate-900 px-5 py-2 text-sm font-bold">
        Back to USwapped
      </Link>
    </div>
  );
}

export default function Admin() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const isAdmin = me?.role === "admin";
  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => apiGet<AdminStats>("/admin/stats"),
    enabled: isAdmin,
  });
  if (!isAdmin) return <NotAdmin />;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10" data-testid="admin-portal">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white">
            <ShieldCheck className="size-3.5" /> Admin portal
          </p>
          <h1 className="mt-3 text-4xl font-extrabold text-slate-900" data-testid="admin-title">Run USwapped</h1>
          <p className="mt-1 text-slate-600">Signed in as {me.email}. Every action you take here is recorded in the audit log.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })} className="mt-8">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 rounded-2xl border-2 border-slate-900 bg-white p-1.5">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              data-testid={`admin-tab-${t.id}`}
              className="gap-1.5 rounded-xl px-3.5 py-2 data-active:bg-slate-900 data-active:text-white"
            >
              <t.icon className="size-4" /> {t.label}
              {t.id === "reports" && (stats?.open_reports ?? 0) > 0 && (
                <span className="rounded-full bg-pink-400 px-1.5 text-[10px] font-extrabold text-slate-900" data-testid="admin-open-reports-badge">
                  {stats?.open_reports}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="mt-6"><OverviewPanel /></TabsContent>
        <TabsContent value="reports" className="mt-6"><ReportsPanel /></TabsContent>
        <TabsContent value="listings" className="mt-6"><ListingsPanel /></TabsContent>
        <TabsContent value="users" className="mt-6"><UsersPanel selfId={me.user_id} /></TabsContent>
        <TabsContent value="swaps" className="mt-6"><SwapsPanel /></TabsContent>
        <TabsContent value="transactions" className="mt-6"><TransactionsPanel /></TabsContent>
        <TabsContent value="audit" className="mt-6"><AuditPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
