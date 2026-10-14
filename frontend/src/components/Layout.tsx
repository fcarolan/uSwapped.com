import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowLeftRight, Coins, LayoutDashboard, LogOut, Plus, Menu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useMe, startGoogleLogin } from "@/lib/hooks";
import { endSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" data-testid="brand-logo" className={cn("group flex items-center gap-2", className)}>
      <span className="brutal grid size-9 place-items-center rounded-xl bg-emerald-400 transition-transform duration-300 group-hover:rotate-180">
        <ArrowLeftRight className="size-5 text-slate-900" strokeWidth={2.75} />
      </span>
      <span className="font-heading text-xl font-extrabold tracking-tight text-slate-900">
        USwapped<span className="text-emerald-600">.com</span>
      </span>
    </Link>
  );
}

const NAV = [
  { to: "/browse", label: "Browse", testid: "nav-browse" },
  { to: "/how-it-works", label: "How it works", testid: "nav-how" },
  { to: "/credits", label: "Swap Credits", testid: "nav-credits" },
];

function NavItems({ onClick }: { onClick?: () => void }) {
  return (
    <>
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          onClick={onClick}
          data-testid={n.testid}
          className={({ isActive }) =>
            cn(
              "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150",
              isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-800",
            )
          }
        >
          {n.label}
        </NavLink>
      ))}
    </>
  );
}

function Header() {
  const { data: me } = useMe();
  return (
    <header className="sticky top-0 z-50 border-b-2 border-slate-900 bg-[#FAFAF7]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          <NavItems />
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {me ? (
            <>
              <Link
                to="/credits"
                data-testid="header-credit-balance"
                className="brutal brutal-hover hidden items-center gap-1.5 rounded-full bg-amber-200 px-3 py-1 text-sm font-bold text-slate-900 sm:flex"
              >
                <Coins className="size-4" /> {me.credits} credits
              </Link>
              <Link
                to="/list"
                data-testid="header-list-item-button"
                className={cn(buttonVariants({ size: "sm" }), "brutal brutal-hover hidden rounded-full sm:inline-flex")}
              >
                <Plus className="size-4" /> List item
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  data-testid="user-menu-trigger"
                  className="brutal grid size-9 place-items-center overflow-hidden rounded-full bg-white"
                >
                  {me.picture ? (
                    <img src={me.picture} alt={me.name} className="size-full object-cover" />
                  ) : (
                    <span className="font-bold">{me.name[0]}</span>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5 text-sm">
                    <p className="font-semibold" data-testid="user-menu-name">{me.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{me.email}</p>
                  </div>
                  <DropdownMenuItem data-testid="user-menu-dashboard" onClick={() => (window.location.href = "/dashboard")}>
                    <LayoutDashboard className="size-4" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="user-menu-logout" onClick={() => void endSession("/")}>
                    <LogOut className="size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              data-testid="header-signin-button"
              onClick={startGoogleLogin}
              className="brutal brutal-hover rounded-full"
            >
              Sign in
            </Button>
          )}
          <Sheet>
            <SheetTrigger
              data-testid="mobile-nav-trigger"
              className="grid size-9 place-items-center rounded-lg border-2 border-slate-900 md:hidden"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="p-6">
              <SheetTitle className="mb-4">Menu</SheetTitle>
              <div className="flex flex-col items-start gap-2">
                <NavItems />
                {me && (
                  <>
                    <Link to="/list" className="px-3 py-1.5 text-sm font-semibold">List item</Link>
                    <Link to="/dashboard" className="px-3 py-1.5 text-sm font-semibold">Dashboard</Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t-2 border-slate-900 bg-slate-900 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="font-heading text-2xl font-extrabold text-white">
            USwapped<span className="text-emerald-400">.com</span>
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
            Swap your stuff, not your cash. Every swapper sends their own item and covers their own postage &amp;
            packaging.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Swap</p>
          <Link to="/browse" className="hover:text-white">Browse items</Link>
          <Link to="/list" className="hover:text-white">List an item</Link>
          <Link to="/how-it-works" className="hover:text-white">How it works</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Credits</p>
          <Link to="/credits" className="hover:text-white">Buy Swap Credits</Link>
          <Link to="/dashboard" className="hover:text-white">My wallet</Link>
        </div>
      </div>
      <p className="border-t border-slate-800 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} USwapped.com · Payments secured by Stripe
      </p>
    </footer>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <Toaster richColors />
    </div>
  );
}
