import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Home, LayoutGrid, Plus, Tag, User, Download, Share, X } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Home", icon: Home, testid: "tab-bar-home", end: true },
  { to: "/browse", label: "Browse", icon: LayoutGrid, testid: "tab-bar-browse", end: false },
  { to: "/list", label: "List", icon: Plus, testid: "tab-bar-list", end: false, primary: true },
  { to: "/pricing", label: "Pricing", icon: Tag, testid: "tab-bar-pricing", end: false },
  { to: "/dashboard", label: "Me", icon: User, testid: "tab-bar-me", end: false },
];

export function MobileTabBar() {
  return (
    <nav
      data-testid="mobile-tab-bar"
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-slate-900 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="grid grid-cols-5">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            data-testid={t.testid}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold transition-colors duration-150",
                isActive ? "text-emerald-700" : "text-slate-500",
              )
            }
          >
            {({ isActive }) =>
              t.primary ? (
                <>
                  <span className="-mt-5 grid size-12 place-items-center rounded-full border-2 border-slate-900 bg-emerald-400 text-slate-900 shadow-[3px_3px_0_#0f172a] transition-transform duration-150 active:scale-90">
                    <t.icon className="size-6" strokeWidth={2.75} />
                  </span>
                  {t.label}
                </>
              ) : (
                <>
                  <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors duration-150", isActive && "bg-emerald-100")}>
                    <t.icon className="size-5" strokeWidth={isActive ? 2.75 : 2} />
                  </span>
                  {t.label}
                </>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "uswapped-install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (standalone || dismissed || (!deferred && !isIOS)) return null;

  const close = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      data-testid="install-prompt"
      className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 animate-pop-in rounded-2xl border-2 border-slate-900 bg-amber-200 p-4 shadow-[4px_4px_0_#0f172a] md:hidden"
    >
      <button type="button" aria-label="Dismiss" data-testid="install-prompt-dismiss" onClick={close} className="absolute right-2 top-2 p-1">
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <img src="/icon-192.png" alt="" className="size-11 rounded-xl border-2 border-slate-900" />
        <div className="text-sm">
          <p className="font-heading font-extrabold">Get the USwapped app</p>
          {deferred ? (
            <p className="text-slate-700">Install it on your home screen. It's free and takes 2 seconds.</p>
          ) : (
            <p className="text-slate-700" data-testid="install-prompt-ios-hint">
              Tap <Share className="inline size-3.5" /> Share, then <strong>Add to Home Screen</strong>.
            </p>
          )}
        </div>
      </div>
      {deferred && (
        <button
          type="button"
          data-testid="install-prompt-install"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
            close();
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-2.5 text-sm font-bold text-white"
        >
          <Download className="size-4" /> Install app
        </button>
      )}
    </div>
  );
}
