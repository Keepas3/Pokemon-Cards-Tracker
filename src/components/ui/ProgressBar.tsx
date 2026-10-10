/** A thin progress bar. `value` and `max` are counts; the bar fills to their ratio. */
export default function ProgressBar({
  value,
  max,
  label,
  complete,
}: {
  value: number;
  max: number;
  label: string;
  /** Turns the bar green (e.g. a finished set). */
  complete?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className={`h-full rounded-full ${complete ? "bg-good" : "bg-accent"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
