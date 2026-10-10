import type { DiscordEmbed, DiscordPayload } from "@/lib/notify/discord";
import { digestIsEmpty } from "./types";
import type { Digest } from "./types";

// Turns a Digest into the Discord message. Pure: Discord rejects a message
// over its size limits (4,096 characters per embed description, 6,000 across
// all embeds), and a digest is exactly the kind of message that grows — so the
// limits are enforced here and covered by tests, not found out at 9am.

const MAX_ROWS = 8;
const MAX_LINE = 160;
export const MAX_TOTAL_CHARS = 5500; // headroom under Discord's 6,000

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const clip = (text: string, max = MAX_LINE) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Lists up to MAX_ROWS lines, summarising the remainder rather than dropping it silently. */
function rows(lines: string[]): string {
  const shown = lines.slice(0, MAX_ROWS).map((l) => clip(l));
  const rest = lines.length - shown.length;
  return [...shown, ...(rest > 0 ? [`…and ${rest} more`] : [])].join("\n");
}

function sectionEmbeds(d: Digest): DiscordEmbed[] {
  const embeds: DiscordEmbed[] = [];

  if (d.cardMoves.length > 0) {
    embeds.push({
      title: `💰 Watchlist moves (${d.cardMoves.length})`,
      description: rows(
        d.cardMoves.map((m) => {
          const arrow = m.toCents < m.fromCents ? "▼" : "▲";
          const alert = m.thresholdCents != null ? ` (your alert ≤ ${money(m.thresholdCents)})` : "";
          return `${arrow} **${m.cardName}** — ${m.setName}: ${money(m.fromCents)} → ${money(m.toCents)}${alert}`;
        }),
      ),
      color: 0xf59e0b,
    });
  }

  if (d.smartAlerts.length > 0) {
    embeds.push({
      title: `🎯 Smart alerts (${d.smartAlerts.reduce((n, g) => n + g.items.length, 0)} new matches)`,
      description: rows(
        d.smartAlerts.map((g) => {
          const best = [...g.items]
            .sort((a, b) => a.priceCents - b.priceCents)
            .slice(0, 3)
            .map((i) => `${i.name} ${money(i.priceCents)}`)
            .join(", ");
          const more = g.items.length > 3 ? `, +${g.items.length - 3} more` : "";
          return `• **${g.watchName}** — ${g.items.length} new: ${best}${more}`;
        }),
      ),
      color: 0x8b5cf6,
    });
  }

  if (d.deals.length > 0) {
    embeds.push({
      title: `🏷️ Deals on cards you're missing (${d.deals.length})`,
      description: rows(
        d.deals.map((x) => {
          const where = [x.setName, x.number].filter(Boolean).join(" ");
          const flag = x.suspicious ? " ⚠️ unusually low — check condition" : "";
          return `• [${x.name}](${x.url}) — ${where}: **${money(x.lowCents)}** (market ${money(x.marketCents)}, ${Math.round(x.savingsPct * 100)}% off)${flag}`;
        }),
      ),
      color: 0x14b8a6,
      footer: { text: "Lowest listing on TCGplayer, any condition" },
    });
  }

  return embeds;
}

/** Total characters Discord counts across a message's embeds. */
export function embedChars(payload: DiscordPayload): number {
  return (payload.embeds ?? []).reduce(
    (n, e) => n + (e.title?.length ?? 0) + (e.description?.length ?? 0) + (e.footer?.text.length ?? 0),
    0,
  );
}

/** The digest as a Discord message, or null when there's nothing to report. */
export function formatDigest(d: Digest): DiscordPayload | null {
  if (digestIsEmpty(d)) return null;

  const day = new Date(d.until).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const payload: DiscordPayload = { content: `☀️ **Morning digest** — ${day}`, embeds: sectionEmbeds(d) };

  // Rows are already capped, but long names across all the sections could in
  // theory still pass the total — trim the tail of the longest section until it fits.
  while (embedChars(payload) > MAX_TOTAL_CHARS && payload.embeds!.length > 0) {
    const longest = payload.embeds!.reduce((a, b) => ((a.description?.length ?? 0) >= (b.description?.length ?? 0) ? a : b));
    const lines = (longest.description ?? "").split("\n");
    if (lines.length <= 1) {
      longest.description = clip(longest.description ?? "", 200);
      if (embedChars(payload) > MAX_TOTAL_CHARS) payload.embeds = payload.embeds!.filter((e) => e !== longest);
    } else {
      longest.description = [...lines.slice(0, -2), "…and more"].join("\n");
    }
  }

  return payload;
}
