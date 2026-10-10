import type { ReactNode } from "react";

/** What a list shows when it has nothing in it yet: a headline and what to do next. */
export default function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-8 text-center">
      <p className="font-medium text-fg">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}
