"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, Target, Receipt, LineChart, Atom, Clock } from "lucide-react";

const links = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/assets", label: "Actifs", icon: Wallet },
  { href: "/galaxy", label: "Galaxie", icon: Atom },
  { href: "/goals", label: "Objectifs", icon: Target },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/budget", label: "Budget", icon: Receipt },
  { href: "/projection", label: "Projection", icon: LineChart },
];

export default function Sidebar() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface/40 flex flex-col h-screen sticky top-0">
      <div className="px-6 py-6 border-b border-border">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-[family-name:var(--font-heading)] font-semibold tracking-tight">
            Aurevia
          </span>
        </div>
        <p className="text-xs text-text-muted mt-1">Suivi de patrimoine</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors relative ${
                active
                  ? "bg-accent-soft text-text"
                  : "text-text-muted hover:text-text hover:bg-surface-hover"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-accent" />
              )}
              <Icon size={17} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-border text-[11px] text-text-muted leading-relaxed">
        Données stockées dans ta propre base Postgres.
      </div>
    </aside>
  );
}
