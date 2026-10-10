/** True when `now`'s hour falls within [startHour, endHour) — handles wrapping past midnight. */
export function isQuietHours(now: Date, startHour: number | null, endHour: number | null): boolean {
  if (startHour == null || endHour == null) return false;
  const hour = now.getHours();
  if (startHour === endHour) return false; // degenerate range = always allowed
  if (startHour < endHour) {
    return hour >= startHour && hour < endHour;
  }
  // wraps past midnight, e.g. 22 -> 7
  return hour >= startHour || hour < endHour;
}
