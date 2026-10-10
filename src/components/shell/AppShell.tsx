"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Icon from "@/components/ui/Icon";
import NavLinks from "./NavLinks";
import ProfileSwitcher from "./ProfileSwitcher";
import SessionGuard from "./SessionGuard";
import ThemeToggle from "./ThemeToggle";
import Wordmark from "./Wordmark";

/**
 * The frame around every page: a left sidebar on desktop, and on phones a slim
 * top bar plus a bottom tab bar. Settings and the theme control live apart from
 * the four main destinations. The sign-in page gets no frame.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path === "/unlock") return <>{children}</>;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[14.5rem_minmax(0,1fr)]">
      <SessionGuard />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:ring-2 focus:ring-accent"
      >
        Skip to content
      </a>

      <aside className="hidden flex-col gap-6 border-r border-line bg-surface px-3 py-5 md:sticky md:top-0 md:flex md:h-dvh">
        <div className="space-y-4 px-2">
          <Wordmark />
          <ProfileSwitcher />
        </div>
        <nav aria-label="Main">
          <NavLinks variant="sidebar" />
        </nav>
        <div className="mt-auto space-y-3">
          <nav aria-label="Settings">
            <NavLinks variant="sidebar" group="footer" />
          </nav>
          <div className="px-2">
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-2 border-b border-line bg-bg/90 px-4 backdrop-blur md:hidden">
          <Wordmark />
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <ProfileSwitcher className="min-w-0 max-w-44 flex-1" />
            <Link href="/settings" aria-label="Settings" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
              <Icon name="settings" className="h-[1.125rem] w-[1.125rem]" />
            </Link>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-10">
          {children}
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <NavLinks variant="tabbar" />
      </nav>
    </div>
  );
}
