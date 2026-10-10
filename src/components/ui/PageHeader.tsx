import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./Icon";

/** The title block every page starts with: optional back link, title, one line of context, and actions on the right. */
export default function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6 space-y-2">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-xs text-subtle hover:text-fg">
          <Icon name="back" className="h-3.5 w-3.5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[1.375rem] font-semibold leading-tight tracking-tight">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
