import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startGoogleLogin } from "@/lib/hooks";
import { SiFacebook, SiGoogle } from "@icons-pack/react-simple-icons";

export default function Login() {
  const [params] = useSearchParams();
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
      <div>
        <h1 className="text-5xl font-extrabold leading-tight text-slate-900" data-testid="login-title">
          Welcome to the swap club.
        </h1>
        <p className="mt-4 text-lg text-slate-700">
          Sign in to list items, propose swaps and grab your <strong>3 free credits</strong>.
        </p>
        <div className="mt-8 hidden size-24 animate-float place-items-center rounded-3xl border-2 border-slate-900 bg-emerald-400 shadow-[4px_4px_0_#0f172a] md:grid">
          <ArrowLeftRight className="size-10" strokeWidth={2.75} />
        </div>
      </div>
      <div className="brutal space-y-4 rounded-3xl bg-white p-8">
        {params.get("error") && (
          <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" data-testid="login-error">
            Sign-in didn't complete. Please try again.
          </p>
        )}
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
          disabled
          className="h-12 w-full rounded-full bg-[#1877F2] text-base font-bold text-white opacity-60"
        >
          <SiFacebook size={18} color="#fff" /> Facebook — coming soon
        </Button>
        <p className="pt-2 text-center text-xs text-slate-500">
          By continuing you agree to swap kindly and post your items on time. <Link to="/how-it-works" className="underline">How it works</Link>
        </p>
      </div>
    </div>
  );
}
