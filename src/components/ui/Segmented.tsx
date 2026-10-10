import Link from "next/link";
import type { ReactNode } from "react";

export interface SegmentItem<K extends string = string> {
  key: K;
  label: ReactNode;
  /** A small count shown after the label. */
  count?: number;
  /** When set the item is a link (page navigation) rather than a button. */
  href?: string;
}

/**
 * A pill-shaped switcher: either a row of buttons that change local state, or
 * links between pages. One look for every "choose a view" control on the site.
 */
export default function Segmented<K extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: SegmentItem<K>[];
  value: K;
  onChange?: (key: K) => void;
  /** Accessible name for the group. */
  label: string;
}) {
  const cls = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg"
    }`;

  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
      {items.map((item) => {
        const active = item.key === value;
        const content = (
          <>
            {item.label}
            {item.count != null && <span className="num text-xs text-subtle">{item.count}</span>}
          </>
        );
        return item.href ? (
          <Link key={item.key} href={item.href} aria-current={active ? "page" : undefined} className={cls(active)}>
            {content}
          </Link>
        ) : (
          <button key={item.key} type="button" aria-pressed={active} onClick={() => onChange?.(item.key)} className={cls(active)}>
            {content}
          </button>
        );
      })}
    </div>
  );
}
