const hasControlCharacter = (text: string) => [...text].some((ch) => ch.codePointAt(0)! < 32 || ch.codePointAt(0) === 127);

/**
 * Where to go after signing in. Only a path on this site is allowed: anything that could
 * send the browser somewhere else ("//evil.example", "https://…", a backslash trick) falls back
 * to the home page, so the sign-in page can't be used as an open redirect.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || next.length > 2048) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  if (hasControlCharacter(next)) return "/";
  if (next === "/unlock" || next.startsWith("/unlock?") || next.startsWith("/unlock/")) return "/";
  if (next.startsWith("/api/")) return "/";
  return next;
}
