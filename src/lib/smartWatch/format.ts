import type { DiscordPayload } from "@/lib/notify/discord";

// Formats a smart-alert Discord message. Pure, so Discord's size limits (an
// embed description tops out at 4,096 characters) are checked in tests rather
// than discovered when a big batch of matches fails to send.

export interface AlertItem {
  name: string;
  number: string | null;
  priceCents: number;
  url: string;
}

/** How many matches are listed before the rest are summarised as "and N more". */
export const MAX_LISTED = 10;

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Keeps one line from ever blowing the description limit on its own.
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function formatSmartWatchAlert(opts: {
  watchName: string;
  setName: string;
  items: AlertItem[];
}): DiscordPayload {
  const { watchName, setName, items } = opts;
  const sorted = [...items].sort((a, b) => a.priceCents - b.priceCents);
  const listed = sorted.slice(0, MAX_LISTED);
  const rest = sorted.length - listed.length;

  const lines = listed.map(
    (i) => `• [${clip(i.name, 90)}](${i.url}) — **${money(i.priceCents)}**`,
  );
  if (rest > 0) lines.push(`…and ${rest} more`);

  const count = items.length;
  return {
    content: `🎯 **${count} new match${count === 1 ? "" : "es"}** for your alert in ${setName}`,
    embeds: [
      {
        title: clip(`Smart alert: ${watchName}`, 200),
        description: lines.join("\n"),
        color: 0x8b5cf6,
        footer: { text: setName },
      },
    ],
  };
}
