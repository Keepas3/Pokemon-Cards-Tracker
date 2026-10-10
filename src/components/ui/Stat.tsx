import type { ReactNode } from "react";

const TONES = {
  default: "text-fg",
  good: "text-good",
  warn: "text-warn",
  accent: "text-accent-text",
} as const;

/** A single headline number with a label (and an optional line of detail). */
export default function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-subtle">{label}</p>
      <p className={`num mt-0.5 text-2xl font-semibold tracking-tight ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
