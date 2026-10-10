import type { ApiBudgetDTO } from "@/lib/clientTypes";

/** A refresh problem (amber) and, when known, how much of the free tier's daily budget is left. */
export default function ApiStatus({ error, budget }: { error: string | null; budget: ApiBudgetDTO | null }) {
  return (
    <>
      {error && (
        <p className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">{error}</p>
      )}
      {budget?.dailyRemaining != null && (
        <p className="text-xs text-subtle">
          tcgapi.dev requests left today: {budget.dailyRemaining}
          {budget.dailyLimit != null ? ` of ${budget.dailyLimit}` : ""} · saved data is reused so browsing costs little
        </p>
      )}
    </>
  );
}
