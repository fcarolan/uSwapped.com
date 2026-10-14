import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { SiFacebook, SiGoogle } from "@icons-pack/react-simple-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { queryClient } from "@/lib/queryClient";
import { errorMessage, startGoogleLogin } from "@/lib/hooks";
import type { AuthProviders, LoginBody, RegisterBody, User } from "@/lib/types";

type Mode = "signin" | "signup";
const field = "h-11 rounded-xl border-2 border-slate-900 bg-white";

function EmailForm({ mode, next }: { mode: Mode; next: string }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const auth = useMutation({
    mutationFn: () =>
      mode === "signup"
        ? apiPost<User>("/auth/register", { name: name.trim(), email: email.trim(), password } satisfies RegisterBody)
        : apiPost<User>("/auth/login", { email: email.trim(), password } satisfies LoginBody),
    onSuccess: (user) => {
      beginSession();
      queryClient.setQueryData(["me"], user);
      toast.success(mode === "signup" ? `Welcome to USwapped, ${user.name.split(" ")[0]}!` : "Signed in");
      navigate(user.role === "admin" && next === "/dashboard" ? "/admin" : next, { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e, "Sign-in failed")),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && password.length < 8) return toast.error("Use at least 8 characters for your password");
    auth.mutate();
  };
  return (
    <form onSubmit={submit} className="space-y-3" data-testid={`login-${mode}-form`}>
      {mode === "signup" && (
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" data-testid="login-name-input" className={field} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} autoComplete="name" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" data-testid="login-email-input" className={field} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          data-testid="login-password-input"
          className={field}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === "signup" ? 8 : 1}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {mode === "signup" && <p className="text-xs text-slate-500">At least 8 characters.</p>}
      </div>
      <Button type="submit" data-testid="login-submit-button" disabled={auth.isPending} className="brutal brutal-hover h-12 w-full rounded-full text-base font-bold">
        {auth.isPending ? "Please wait…" : mode === "signup" ? "Create free account" : "Sign in"}
      </Button>
    </form>
  );
}

export default function Login() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const next = params.get("next") || "/dashboard";
  const { data: providers } = useQuery({ queryKey: ["auth-providers"], queryFn: () => apiGet<AuthProviders>("/auth/providers") });
  const facebookOn = providers?.facebook === true;
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
      <div>
        <h1 className="text-5xl font-extrabold leading-tight text-slate-900" data-testid="login-title">
          Welcome to the swap club.
        </h1>
        <p className="mt-4 text-lg text-slate-700">
          Sign in to list items for <strong>free</strong> and start swapping.
        </p>
        <div className="mt-8 hidden size-24 animate-float place-items-center rounded-3xl border-2 border-slate-900 bg-emerald-400 shadow-[4px_4px_0_#0f172a] md:grid">
          <ArrowLeftRight className="size-10" strokeWidth={2.75} />
        </div>
      </div>
      <div className="brutal space-y-4 rounded-3xl bg-white p-8">
        {params.get("error") && (
          <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" data-testid="login-error">
            {params.get("error") === "suspended" ? "This account has been suspended." : "Sign-in didn't complete. Please try again."}
          </p>
        )}
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-2 rounded-full border-2 border-slate-900 bg-white p-1">
            <TabsTrigger value="signin" data-testid="login-tab-signin" className="rounded-full data-active:bg-slate-900 data-active:text-white">
              Sign in
            </TabsTrigger>
            <TabsTrigger value="signup" data-testid="login-tab-signup" className="rounded-full data-active:bg-slate-900 data-active:text-white">
              Create account
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <EmailForm key={mode} mode={mode} next={next} />
        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
        </div>
        <Button
          data-testid="login-google-button"
          onClick={startGoogleLogin}
          variant="outline"
          className="brutal brutal-hover h-12 w-full rounded-full border-slate-900 bg-white text-base font-bold"
        >
          <SiGoogle size={18} color="#4285F4" /> Continue with Google
        </Button>
        <Button
          data-testid="login-facebook-button"
          disabled={!facebookOn}
          onClick={() => window.location.assign("/api/auth/facebook/login")}
          className={`h-12 w-full rounded-full bg-[#1877F2] text-base font-bold text-white hover:bg-[#166FE5] ${facebookOn ? "brutal brutal-hover" : "opacity-60"}`}
        >
          <SiFacebook size={18} color="#fff" /> {facebookOn ? "Continue with Facebook" : "Facebook — coming soon"}
        </Button>
        <p className="pt-2 text-center text-xs text-slate-500">
          By continuing you agree to swap kindly and post your items on time. <Link to="/how-it-works" className="underline">How it works</Link>
        </p>
      </div>
    </div>
  );
}
