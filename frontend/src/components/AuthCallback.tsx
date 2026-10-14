import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { queryClient } from "@/lib/queryClient";
import type { User } from "@/lib/types";

// Exchanges the Emergent Auth session_id (URL fragment) for an httpOnly session cookie.
export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const match = location.hash.match(/session_id=([^&]+)/);
    const sessionId = match ? decodeURIComponent(match[1]) : "";
    apiPost<User>("/auth/session", { session_id: sessionId })
      .then((user) => {
        beginSession();
        queryClient.setQueryData(["me"], user);
        navigate(location.pathname === "/" ? "/dashboard" : location.pathname, { replace: true });
      })
      .catch(() => navigate("/login?error=1", { replace: true }));
  }, [location, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-[#FAFAF7]" data-testid="auth-callback">
      <p className="font-heading text-lg font-bold text-slate-700">Signing you in…</p>
    </div>
  );
}
