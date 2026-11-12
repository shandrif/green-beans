import { NavLink, Outlet, useLocation } from "react-router";
import { LayoutDashboard, Inbox, KanbanSquare, Coffee, Building2, Shield, LogOut, Languages, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { ROLE_LABELS } from "../../shared/workflow";
import { useAuth, useUser } from "../lib/auth";
import { useI18n, type DictKey } from "../lib/i18n";
import { Logo, cx } from "./ui";

interface NavItem {
  to: string;
  label: DictKey;
  icon: ReactNode;
  show?: (role: string) => boolean;
  mobile?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "dashboard", icon: <LayoutDashboard className="size-[18px]" />, mobile: true },
  { to: "/queue", label: "myQueue", icon: <Inbox className="size-[18px]" />, show: (r) => r !== "viewer", mobile: true },
  { to: "/board", label: "board", icon: <KanbanSquare className="size-[18px]" />, mobile: true },
  { to: "/samples", label: "samples", icon: <Coffee className="size-[18px]" />, mobile: true },
  { to: "/suppliers", label: "suppliers", icon: <Building2 className="size-[18px]" /> },
  { to: "/admin", label: "admin", icon: <Shield className="size-[18px]" />, show: (r) => r === "admin" },
];

export function Layout() {
  const user = useUser();
  const { signOut, changeLang } = useAuth();
  const { t, l, lang } = useI18n();
  const { pathname } = useLocation();
  const items = NAV.filter((n) => !n.show || n.show(user.role));

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-line/80 bg-sand md:flex">
        <div className="flex items-center gap-3 px-5 pb-6 pt-6">
          <Logo size={38} />
          <div className="leading-tight">
            <p className="font-bold text-ink">{t("appName")}</p>
            <p className="text-xs text-muted">{t("appTagline")}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={cx(
                "relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150",
                isActive(n.to) ? "bg-paper text-ink shadow-card" : "text-ink-2 hover:bg-sand-2 hover:text-ink",
              )}
            >
              {isActive(n.to) && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-tan" aria-hidden />}
              {n.icon}
              {t(n.label)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line/80 p-3">
          <button
            onClick={() => changeLang(lang === "en" ? "ar" : "en")}
            className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-sand-2 active:scale-[0.98]"
          >
            <Languages className="size-[18px]" />
            {t("language")}
          </button>
          <NavLink
            to="/account"
            className={({ isActive }) =>
              cx(
                "mt-1 flex items-center gap-3 rounded-xl px-3 py-2 transition-colors",
                isActive ? "bg-paper shadow-card" : "hover:bg-sand-2",
              )
            }
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal text-sm font-semibold text-ink">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
              <span className="block truncate text-xs text-muted">{l(ROLE_LABELS[user.role])}</span>
            </span>
          </NavLink>
          <button
            onClick={signOut}
            className="mt-1 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted transition-colors hover:bg-sand-2 hover:text-ink active:scale-[0.98]"
          >
            <LogOut className="size-[18px] rtl:-scale-x-100" />
            {t("signOut")}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/70 bg-sand/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="font-bold">{t("appName")}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => changeLang(lang === "en" ? "ar" : "en")}
            className="h-9 rounded-full px-3 text-sm font-medium text-ink-2 active:scale-95"
          >
            {t("language")}
          </button>
          <NavLink to="/account" className="grid size-9 place-items-center rounded-full bg-teal text-sm font-semibold active:scale-95" aria-label={t("account")}>
            <UserRound className="size-4" />
          </NavLink>
        </div>
      </header>

      <main className="min-w-0 px-4 pb-28 pt-5 sm:px-6 md:px-10 md:pb-12 md:pt-9">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line/70 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {[...items.filter((n) => n.mobile), ...items.filter((n) => !n.mobile)].slice(0, 5).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={cx(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              isActive(n.to) ? "text-ink" : "text-muted",
            )}
          >
            <span className={cx("grid h-7 w-12 place-items-center rounded-full transition-colors duration-200", isActive(n.to) && "bg-tan-soft")}>{n.icon}</span>
            {t(n.label)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
