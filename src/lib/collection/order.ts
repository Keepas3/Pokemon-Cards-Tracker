// Putting a series' sets in the order one person chose. Pure.

/**
 * `sets` arrive in the default order (newest first). Sets the person has moved (they have a position)
 * keep the order they chose and go after the rest, so a brand-new set shows first instead of being
 * lost at the end of a hand-sorted list.
 */
export function applySetOrder<T>(sets: readonly T[], positionOf: (set: T) => number | undefined): T[] {
  const unmoved: T[] = [];
  const moved: { set: T; position: number }[] = [];
  for (const set of sets) {
    const position = positionOf(set);
    if (position === undefined) unmoved.push(set);
    else moved.push({ set, position });
  }
  moved.sort((a, b) => a.position - b.position);
  return [...unmoved, ...moved.map((m) => m.set)];
}

/** Moves the item at `from` to where `to` is, shifting the rest along (what dragging one tile onto another means). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const MAX_ORDER_SETS = 500;
