"use client";

/** "+ Own" for a card you don't have, a − n + counter for one you do. */
export default function OwnedControl({ owned, onChange }: { owned: number; onChange: (quantity: number) => void }) {
  if (owned <= 0) {
    return (
      <button onClick={() => onChange(1)} title="Mark one copy as owned" className="btn btn-sm">
        + Own
      </button>
    );
  }
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-good/40 bg-good-soft text-xs font-medium text-good">
      <button onClick={() => onChange(owned - 1)} aria-label="Remove one copy" className="px-2 py-1 hover:bg-good/15">
        −
      </button>
      <span className="num min-w-[1.5rem] px-1 text-center" aria-label={`${owned} owned`}>
        {owned}
      </span>
      <button onClick={() => onChange(owned + 1)} aria-label="Add one copy" className="px-2 py-1 hover:bg-good/15">
        +
      </button>
    </div>
  );
}
