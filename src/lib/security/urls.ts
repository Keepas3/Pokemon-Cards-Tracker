// URL checks for anything the app stores or sends to. Pure, so the rules are tested.

const MAX_URL_LENGTH = 2048;

/**
 * The normalised URL if `value` is a plain http(s) link without embedded credentials,
 * otherwise null. Used before saving a link a person typed in and before rendering one
 * that came from another service, so a `javascript:` or `data:` address never reaches an href.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  return url.href;
}

/** For rendering: the link if it's safe, otherwise undefined (React then omits the href). */
export function safeHref(value: string | null | undefined): string | undefined {
  return safeHttpUrl(value) ?? undefined;
}

const DISCORD_HOSTS = new Set(["discord.com", "ptb.discord.com", "canary.discord.com", "discordapp.com"]);
const WEBHOOK_PATH = /^\/api(?:\/v\d+)?\/webhooks\/\d{5,25}\/[A-Za-z0-9_-]{20,200}$/;

/**
 * The webhook URL if it is a real Discord incoming-webhook address, otherwise null.
 * The app POSTs to whatever is saved here, so anything else (an internal address, another
 * site) must never be accepted: that would let a stray request turn the app into a
 * request-forwarder aimed at your network.
 */
export function parseDiscordWebhook(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !DISCORD_HOSTS.has(url.hostname) || url.port) return null;
  if (url.username || url.password || url.hash) return null;
  if (!WEBHOOK_PATH.test(url.pathname)) return null;
  // Discord documents thread_id and wait; nothing else belongs on the end.
  for (const [key, val] of url.searchParams) {
    if (key === "thread_id" && /^\d{5,25}$/.test(val)) continue;
    if (key === "wait" && (val === "true" || val === "false")) continue;
    return null;
  }
  return url.href;
}

/** A short, non-secret hint of a saved webhook for the Settings page (the secret token stays server-side). */
export function webhookHint(webhookUrl: string | null): string | null {
  const parsed = webhookUrl ? parseDiscordWebhook(webhookUrl) : null;
  if (!parsed) return webhookUrl ? "saved (not a Discord webhook URL — replace it)" : null;
  const token = new URL(parsed).pathname.split("/").pop() ?? "";
  return `discord.com webhook ending …${token.slice(-4)}`;
}
