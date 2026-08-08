"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Wallet } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <aside className="w-12 shrink-0 border-r border-border bg-surface/30 flex flex-col items-center py-4 gap-2 h-screen sticky top-0">
      <Link href="/" className="text-accent font-[family-name:var(--font-heading)] font-bold text-lg mb-4" title="Aurevia">
        A
      </Link>
      <div className="flex-1" />
      <Link
        href="/assets"
        title="Vue tableau"
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover ${pathname === "/assets" ? "bg-accent/15 text-accent" : ""}`}
      >
        <Wallet size={15} />
      </Link>
      <Link
        href="/settings"
        title="Paramètres"
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover ${pathname === "/settings" ? "bg-accent/15 text-accent" : ""}`}
      >
        <Settings size={15} />
      </Link>
    </aside>
  );
}
