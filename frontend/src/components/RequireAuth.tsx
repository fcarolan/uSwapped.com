import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMe } from "@/lib/hooks";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { data: me, isPending, isError } = useMe();
  const location = useLocation();
  if (isPending) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-24 text-center text-slate-500" data-testid="auth-loading">
        Checking your account…
      </div>
    );
  }
  if (isError || !me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}
