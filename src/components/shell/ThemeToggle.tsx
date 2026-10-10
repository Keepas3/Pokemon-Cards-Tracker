"use client";

import { useSyncExternalStore } from "react";
import Icon from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";

type Choice = "system" | "light" | "dark";

const STORAGE_KEY = "theme";
const EVENT = "themechange";

// Reads can fail (private windows, blocked storage); the site must still render.
function readChoice(): Choice {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function choose(choice: Choice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try {
    if (choice === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* the choice still applies for this visit */
  }
  window.dispatchEvent(new Event(EVENT));
}

const OPTIONS: { key: Choice; label: string; icon: IconName }[] = [
  { key: "system", label: "Match system", icon: "monitor" },
  { key: "light", label: "Light", icon: "sun" },
  { key: "dark", label: "Dark", icon: "moon" },
];

/** System / Light / Dark. The choice is remembered; "system" follows the OS setting. */
export default function ThemeToggle({ className = "", showLabels = false }: { className?: string; showLabels?: boolean }) {
  const current = useSyncExternalStore(subscribe, readChoice, () => "system" as Choice);

  return (
    <div role="group" aria-label="Color theme" className={`inline-flex gap-0.5 rounded-lg bg-surface-2 p-0.5 ${className}`}>
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          title={o.label}
          aria-label={o.label}
          aria-pressed={current === o.key}
          onClick={() => choose(o.key)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
            showLabels ? "h-8 px-3" : "h-7 w-7"
          } ${current === o.key ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-subtle hover:text-fg"}`}
        >
          <Icon name={o.icon} className="h-3.5 w-3.5" />
          {showLabels && o.label}
        </button>
      ))}
    </div>
  );
}
